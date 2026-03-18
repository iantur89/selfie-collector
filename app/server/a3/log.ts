/**
 * A3 flow logging — boxed console output for message/tool flow.
 * See docs/a3/HOWTO-logging.md.
 */

const W = 60

function truncate(s: string, maxLen: number = 80): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen - 1) + '…'
}

function box(title: string, lines: string[]): void {
  const border = '═'.repeat(Math.max(0, W - 2 - title.length))
  console.log(`╔══ ${title} ${border}╗`)
  for (const line of lines) {
    const escaped = line.replace(/[\u0000-\u001F]/g, ' ')
    const padded = escaped.length > W - 6 ? escaped.slice(0, W - 9) + '…' : escaped
    console.log(`║ ${padded.padEnd(W - 4)} ║`)
  }
  console.log(`╚${'═'.repeat(W - 2)}╝`)
}

/** Start of processing a user message (Telegram or other). */
export function logA3In(sessionId: string, message: string, opts?: { truncate: boolean }): void {
  const msg = opts?.truncate === false ? message : truncate(message, 80)
  box('A3 IN', [`sessionId=${sessionId}`, `message=${msg}`])
}

/** End of turn: reply and state snapshot. */
export function logA3Out(
  sessionId: string,
  reply: string,
  state: Record<string, unknown> | undefined,
  opts?: { truncateReply: boolean },
): void {
  const replyLine = opts?.truncateReply === false ? reply : truncate(reply, 80)
  const lines = [`sessionId=${sessionId}`, `reply=${replyLine}`]
  if (state != null) {
    const keys = [
      'workflowStage',
      'telegramUserId',
      'idImageS3Key',
      'idVerified',
      'selfieImageS3Key',
      'selfieVerified',
      'faceMatched',
      'consentGiven',
      'consentStatus',
      'paymentCompleted',
      'selfieCount',
      'verificationStatus',
    ]
    for (const k of keys) {
      const v = state[k]
      if (v !== undefined && v !== '') lines.push(`state.${k}=${String(v)}`)
    }
  }
  box('A3 OUT', lines)
}

/** Telegram: received photo (no text). */
export function logTelegramPhoto(
  sessionId: string,
  workflowStage: string,
  branch: 'id_verify_first' | 'id_verify_selfie' | 'ingest' | 'unhandled',
): void {
  box('TELEGRAM PHOTO', [
    `sessionId=${sessionId}`,
    `workflowStage=${workflowStage}`,
    `branch=${branch}`,
  ])
}

/** Telegram: unsupported message type (e.g. document only). */
export function logTelegramUnsupported(sessionId: string, detail: string): void {
  box('TELEGRAM UNSUPPORTED', [`sessionId=${sessionId}`, `detail=${detail}`])
}
