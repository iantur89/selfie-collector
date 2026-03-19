import { createCollectorSession } from '@server/a3/session'
import { withSessionLock } from '@server/session/sessionLock'
import { collectorInitialState } from '@agents/collector'
import { createPayPalPayout } from '@server/integrations/payPalAdapter'

const DEFAULT_AMOUNT_USD = 5
const DEFAULT_CURRENCY = 'USD'

export type ExecutePayoutResult =
  | { ok: true; payoutBatchId: string }
  | { ok: false; code: 'NO_PAYOUT_EMAIL' | 'ALREADY_PAID'; message: string; payoutBatchId?: string }
  | { ok: false; code: 'PAYOUT_FAILED'; message: string }

/**
 * If the session has payoutEmail and no payoutBatchId yet, create a PayPal Payout and store the batch id.
 * Safe to call multiple times (idempotent per session).
 */
export async function executePayoutForSession(
  sessionId: string,
  options?: { amount?: number; currency?: string },
): Promise<ExecutePayoutResult> {
  const amount = options?.amount ?? DEFAULT_AMOUNT_USD
  const currency = options?.currency ?? DEFAULT_CURRENCY

  let result: ExecutePayoutResult | null = null
  await withSessionLock(sessionId, async () => {
    const session = createCollectorSession(sessionId)
    const existing = await session.getSessionData()
    const state = (existing?.state ?? collectorInitialState) as Record<string, unknown>

    const payoutEmail = typeof state.payoutEmail === 'string' && state.payoutEmail.length > 0 ? state.payoutEmail : null
    const payoutBatchId = state.payoutBatchId

    if (!payoutEmail) {
      result = { ok: false, code: 'NO_PAYOUT_EMAIL', message: 'Session has no payout email' }
      return
    }
    if (payoutBatchId) {
      result = { ok: false, code: 'ALREADY_PAID', message: 'Payout already sent', payoutBatchId: String(payoutBatchId) }
      return
    }

    const payoutResult = await createPayPalPayout({
      recipientEmail: payoutEmail,
      amount,
      currency,
      note: 'Thanks for your contribution.',
      senderItemId: sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30),
    })

    if (payoutResult.status === 'success') {
      await session.upsertSessionData({
        activeAgentId: (existing?.activeAgentId ?? 'payment_agent') as any,
        state: {
          ...state,
          payoutBatchId: payoutResult.payoutBatchId,
        } as any,
      })
      result = { ok: true, payoutBatchId: payoutResult.payoutBatchId }
      return
    }

    result = {
      ok: false,
      code: 'PAYOUT_FAILED',
      message: payoutResult.error.message,
    }
  })

  return result ?? { ok: false, code: 'PAYOUT_FAILED', message: 'No result from payout execution' }
}
