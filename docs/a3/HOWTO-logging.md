# How We Do Logging

This doc describes the logging approach used in the a3 demos (e.g. the data-collector bot).

---

## Overview

Logging is **console-based** and focused on the A3 flow. There are no log levels or env toggles; the flow logs run on every message. Other parts of the app use ad-hoc `console.log` / `console.warn` / `console.error`.

---

## A3 Flow Logging

The A3 message-and-tool loop emits structured, boxed logs. All of these live in `data-collector/src/utils/log.ts` and are called from the flow layer.

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
| `logA3AgentResponse` | After agent(s) respond | `activeAgent`, `nextAgent`, transition hint |
| `logA3AgentChange` | When active agent changes (handoff) | `fromAgent → toAgent` |
| `logA3DecidedTool` | Agent output requested a tool | `tool`, `params` |
| `logA3ToolRunning` | Before running the tool | `▶ toolName` |
| `logA3ToolComplete` | After tool finishes | `tool`, `success`, `message`, optional `data` |
| `logA3Out` | End of turn, final reply | `sessionId`, agent transition, `goalAchieved`, truncated `reply`, full state snapshot |

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
