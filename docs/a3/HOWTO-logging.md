# How We Do Logging

This doc describes the logging approach used in the a3 demos (e.g. the data-collector bot).

---

## Overview

Logging is **console-based** and focused on the A3 flow. There are no log levels or env toggles; the flow logs run on every message. Other parts of the app use ad-hoc `console.log` / `console.warn` / `console.error`.

---

## A3 Flow Logging

The A3 message-and-tool loop emits structured, boxed logs. The log helpers live in `app/server/a3/log.ts` and are called from the Telegram handler (`app/server/telegram/handler.ts`) and can be used from other flow layers.

### Box format

Each log event is rendered as an ASCII box with a title and content lines:

```
╔══ A3 IN ═════════════════════════════════════════╗
║ sessionId=tg-12345                                ║
║ message=User sent an image. fileId: abc123        ║
╚═══════════════════════════════════════════════════╝
```

Long strings are truncated (default 80 chars) with `…` unless `truncate: false` is passed. State in `logA3Out` is not truncated so you can inspect full values.

### Log events

| Function | When | Content |
|----------|------|---------|
| `logA3In` | Start of processing a user message | `sessionId`, truncated `message` |
| `logA3Out` | End of turn, final reply | `sessionId`, truncated `reply`, state snapshot (workflowStage, idVerified, etc.) |
| `logTelegramPhoto` | Telegram: user sent a photo | `sessionId`, `workflowStage`, `branch` (id_verify_first \| id_verify_selfie \| ingest \| unhandled) |
| `logTelegramUnsupported` | Telegram: message type not handled | `sessionId`, `detail` |
| *(future)* `logA3AgentResponse` | After agent(s) respond | `activeAgent`, `nextAgent`, transition hint |
| *(future)* `logA3DecidedTool` / `logA3ToolComplete` | Tool invocations | When A3 flow layer is instrumented |

### State snapshot

`logA3Out` prints a subset of state keys: `flowStep`, `telegramUserId`, `idPhotoFileId`, `idVerified`, `selfiePhotoFileId`, `selfieVerified`, `consentGiven`, `consentFormSubmittedAt`, `documentsCollected`, `lastMessageIsFileReceipt`, `validationPassed`, `validationFeedback`, `paymentCompleted`, `toolInvocation`. Arrays like `documentsCollected` are formatted with per-item lines.

---

## Other Logging

- **Flow retries** — `flow.ts`: `console.warn` on retry, `console.error` when all retries fail.
- **Bot errors** — `telegram/bot.ts`: `bot.catch` uses `console.error` and a user-facing reply.
- **Webhook** — `webhook/server.ts`: `console.log` for consent requests and server startup; `console.error` on webhook errors.
- **Startup** — `index.ts`: `console.log` when the bot is running, `console.error` on failure.

---

## No Log Levels or Filters

There is no `LOG_LEVEL`, `DEBUG`, or similar. Flow logs always run. To reduce noise during development you could:

- Add an optional `enableFlowLogs` flag and guard the log calls in the flow layer, or
- Swap the log module for a no-op implementation in tests or quiet mode.
