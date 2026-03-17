# HOWTO: Integrating Telegram with A3

This guide shows how to connect a [Telegram](https://core.telegram.org/bots) bot to [A3](https://github.com/generalui/a3) using only A3’s public interface. It is intended for users of the `@genui-a3/core` npm package. The design is **modular**: Telegram is a thin adapter that turns Telegram updates into a single string message and a session id; A3 stays unchanged. If you run tools (e.g. ID verification) and feed results back via `session.send(toolResultMessage)`, see [HOWTO: Mock ID Verification and A3](HOWTO-mock-id-verification-and-a3.md) for that loop.

---

## What A3 Expects

A3 only knows:

- **Session id** — A string that identifies one conversation (e.g. `tg-12345`). One session = one `SessionStore` entry (state, messages, `activeAgentId`).
- **One message per turn** — A single string. No native concept of “photo”, “document”, or “command”; your adapter turns those into a message string.

Your flow is: **Telegram update → session id + message string → `session.send(message)` → get `responseMessage` (and optionally run tools and send again) → send `responseMessage` back to Telegram.**

---

## What You Need From A3

Same interfaces as in the mock ID HOWTO (no implementation details):

- **`ChatSession<TState>`** — `send(message)` → `SendResult<TState>` (`responseMessage`, `state`, `activeAgentId`, `nextAgentId`); `getSessionData()`, `upsertSessionData(update)`.
- **`SessionStore<TState>`** — Persists session data by session id. You use it via `ChatSession`; you don’t call the store directly from the Telegram layer.
- **`AgentRegistry`** — Register all agents at startup; `ChatSession` and A3 use it internally.
- **`MemorySessionStore`** — In-memory store implementation (or your own persistent store).

You also need a **single entry point** that takes `(sessionId, session, message, context)` and returns the text to show the user. That function should:

1. Optionally ensure the session has a valid `activeAgentId` (e.g. reset to a default agent if missing).
2. Call `session.send(message)`.
3. If your state includes a tool-invocation field and it’s set, run the tool, clear it, call `session.send(toolResultMessage)` and repeat until no tool is requested.
4. Return the final `responseMessage`.

So from the Telegram layer you only call something like:  
`const { responseMessage } = await handleMessage(sessionId, session, message, context)`  
then `ctx.reply(responseMessage)`.

---

## 1. Map Telegram Chat to A3 Session

Use a **stable session id per Telegram chat** so one chat = one A3 session (same state and history).

Common pattern:

```ts
const chatId = ctx.chat?.id ?? ctx.from?.id  // from grammY context
const sessionId = `tg-${chatId}`
```

Use the same `sessionId` for every update in that chat. Create a **new `ChatSession` instance per request** with that `sessionId` and your shared `SessionStore`; A3 will load existing session data on `send()`, so the conversation continues.

---

## 2. Turn Telegram Updates Into One Message String

Normalize every user action into a single string before calling your A3 entry point. Your agents and tools only see this string (and any data you put in state).

| Telegram event | Example message string |
|-----------------|-------------------------|
| Command | `'/start'` |
| Text message | `ctx.message.text` as-is |
| Photo | `User sent an image. fileId: ${largestPhoto.file_id}` |
| Document | `User sent file: fileId=${doc.file_id} fileName=${doc.file_name ?? 'unknown'} mimeType=${doc.mime_type ?? ''}` |

Agents can branch on content (e.g. “User sent an image” → run ID verification tool with `fileId` parsed from the message). Tools that need Telegram file access can receive `fileId` in their params; your tool runner can pass the bot (or API client) in context to download the file when needed.

Keep the format consistent so prompts can say e.g. “When the user sends an image, the message will be 'User sent an image. fileId: <FILE_ID>'”.

---

## 3. Create or Load Session and Call A3

For each update, derive `sessionId`, then create a `ChatSession` with your store and default agent/state:

```ts
const session = new ChatSession<YourState>({
  sessionId,
  store,
  initialAgentId: 'orchestrator',  // or your entry agent
  initialState: { ...defaultState, telegramUserId: String(ctx.from?.id) },
})
```

- **New chat:** No existing session data; first `send()` will use `initialAgentId` and `initialState`.
- **Existing chat:** A3 loads existing session from the store; `initialAgentId`/`initialState` only apply when no data is present.

If you want “send /start first” behavior for photos/documents, check before sending:

```ts
const sessionData = await session.getSessionData()
if (!sessionData) {
  await ctx.reply('Please send /start first to begin.')
  return
}
```

Then compute the normalized message and call your A3 handler:

```ts
const message = normalizeMessage(ctx)  // e.g. text, "User sent an image. fileId: ..."
const { responseMessage } = await handleMessage(sessionId, session, message, context)
await ctx.reply(responseMessage)
```

---

## 4. Optional: Immediate Feedback Before a Tool Runs

If running a tool can take a few seconds (e.g. ID verification), you can send a short reply before running it so the user sees “Validating image...” instead of silence.

In your flow, when you are about to run a tool (e.g. you see `state.toolInvocation`), call an optional callback with the tool name. The Telegram layer can then send a quick reply:

```ts
const { responseMessage } = await handleMessage(sessionId, session, message, {
  bot,
  onBeforeToolRun: async (toolName) => {
    if (toolName === 'verify_id_image') await ctx.reply('Validating image...')
  },
})
await ctx.reply(responseMessage)
```

Your `handleMessage` (or equivalent) invokes `onBeforeToolRun?.(inv.tool)` once per tool run before calling `runTool`. The final reply is still the A3 `responseMessage` after the tool loop finishes.

---

## 5. Handling Commands

- **`/start`** — Treat as the first message: use the same `sessionId = tg-${chatId}`, create session with `initialAgentId` and `initialState` (e.g. welcome state), then `handleMessage(sessionId, session, '/start', context)` and reply with `responseMessage`. That way your entry agent can send the welcome and set routing.
- Other commands — Either normalize to a string (e.g. `message = '/help'`) and send, or handle them in the Telegram layer and only call A3 for non-command updates.

---

## 6. External Events (e.g. Webhook From Another System)

When something happens outside Telegram (e.g. user submitted a form on a website), you can inject it into the same A3 session and get a reply to send back (e.g. via Telegram or the same webhook).

1. Resolve the same **session id** (e.g. you stored `tg-<chatId>` when the user started the flow).
2. Create a `ChatSession` with that `sessionId` and your store.
3. Load session with `getSessionData()`; if missing, handle “session not found”.
4. Update state and optionally switch agent:  
   `session.upsertSessionData({ state: { ...sessionData.state, consentGiven: true, ... }, activeAgentId: 'consent' })`.
5. Call your A3 handler with a **synthetic message**, e.g. `'User has submitted the consent form.'`.
6. Use the returned `responseMessage` as the reply (e.g. send it in Telegram or in the webhook response).

A3 does not care whether the message came from Telegram or from another system; same `session.send(message)` and tool loop.

---

## 7. Error Handling

- **Bot-level:** Use your bot framework’s global error handler (e.g. grammY `bot.catch()`) to log and reply with a safe message like “Something went wrong. Please try again or send /start to restart.”
- **Per-update:** You can wrap `handleMessage` in try/catch and reply with a short error message so the user always gets a response.

---

## 8. Summary

| Responsibility | Where |
|----------------|--------|
| Session id | Telegram adapter: `sessionId = tg-${chatId}`. |
| Message normalization | Telegram adapter: text as-is; photo → `"User sent an image. fileId: ..."`; document → `"User sent file: fileId=... fileName=... mimeType=..."`; command → e.g. `'/start'`. |
| Session creation | Per request: `new ChatSession({ sessionId, store, initialAgentId, initialState })`. |
| One entry point | Your flow: `handleMessage(sessionId, session, message, context)` runs `session.send()` and your tool loop, returns `responseMessage`. |
| Sending to user | Telegram adapter: `ctx.reply(responseMessage)` (and optional `onBeforeToolRun` for “Validating…”). |
| External events | Resolve session id, upsert state/agent, then `handleMessage(sessionId, session, syntheticMessage, context)` and use `responseMessage`. |

By keeping Telegram as a thin adapter (session id + one message string per turn), A3 stays independent of Telegram and you can reuse the same flow for other channels by changing only the adapter.
