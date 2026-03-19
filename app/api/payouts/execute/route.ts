import { NextRequest, NextResponse } from 'next/server'
import { executePayoutForSession } from '@server/payouts/executePayout'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sessionIdRaw = body.sessionId
  const sessionId =
    typeof sessionIdRaw === 'string' && sessionIdRaw.length > 0 && sessionIdRaw.length <= 200 ? sessionIdRaw : null
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing or invalid sessionId' }, { status: 400 })
  }

  const amount = typeof body.amount === 'number' && body.amount > 0 ? body.amount : undefined
  const currency = typeof body.currency === 'string' && body.currency.length === 3 ? body.currency : undefined

  const result = await executePayoutForSession(sessionId, { amount, currency })

  if (result.ok) {
    return NextResponse.json({ ok: true, payoutBatchId: result.payoutBatchId })
  }
  if (result.code === 'ALREADY_PAID') {
    return NextResponse.json({ ok: true, alreadyPaid: true, payoutBatchId: result.payoutBatchId })
  }
  if (result.code === 'NO_PAYOUT_EMAIL') {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 400 })
  }
  return NextResponse.json({ error: result.message, code: result.code }, { status: 502 })
}
