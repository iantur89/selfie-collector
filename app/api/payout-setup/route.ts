import { NextRequest, NextResponse } from 'next/server'
import { createCollectorSession } from '@server/a3/session'
import { withSessionLock } from '@server/session/sessionLock'
import { collectorInitialState } from '@agents/collector'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 200) {
    return NextResponse.json({ error: 'Missing or invalid sessionId' }, { status: 400 })
  }

  const session = createCollectorSession(sessionId)
  const data = await session.getSessionData()
  const state = data?.state as Record<string, unknown> | undefined
  const activeAgentId = data?.activeAgentId
  const consentGiven = state?.consentGiven === true
  const paymentCompleted = state?.paymentCompleted === true

  if (!consentGiven) {
    return NextResponse.json({ error: 'Session not ready for payout setup', code: 'CONSENT_REQUIRED' }, { status: 400 })
  }
  if (paymentCompleted) {
    return NextResponse.json({ ok: true, alreadyComplete: true })
  }

  return NextResponse.json({
    ok: true,
    sessionId,
    ready: true,
    activeAgentId: activeAgentId ?? 'payment_agent',
  })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sessionIdRaw = body.sessionId
  const payoutEmailRaw = body.payoutEmail
  const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw : null
  const payoutEmail = typeof payoutEmailRaw === 'string' ? payoutEmailRaw.trim() : null

  if (!sessionId || sessionId.length > 200) {
    return NextResponse.json({ error: 'Missing or invalid sessionId' }, { status: 400 })
  }
  if (!payoutEmail || !EMAIL_REGEX.test(payoutEmail)) {
    return NextResponse.json({ error: 'Valid payout email required' }, { status: 400 })
  }

  let updated = false
  await withSessionLock(sessionId, async () => {
    const session = createCollectorSession(sessionId)
    const existing = await session.getSessionData()
    const current = (existing?.state ?? collectorInitialState) as Record<string, unknown>
    if (current.paymentCompleted === true) {
      return
    }
    if (current.consentGiven !== true) {
      return
    }

    await session.upsertSessionData({
      activeAgentId: 'payment_agent' as any,
      state: {
        ...current,
        payoutEmail,
        paymentCompleted: true,
        paymentStatus: 'paid',
        workflowStage: 'payment_agent',
      } as any,
    })
    updated = true
  })

  if (!updated) {
    return NextResponse.json({ error: 'Session not ready or payout already complete', code: 'NOT_APPLICABLE' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, sessionId })
}
