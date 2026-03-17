import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ConsentWebhookPayloadSchema } from '@contracts/webhooks'
import { env } from '@server/config/env'
import { getIdempotencyStore } from '@server/idempotency/store'
import { verifyHmacSignature } from '@server/webhooks/signature'
import { applySessionStateUpdate, injectSystemEvent } from '@server/a3/session'
import { registerCollectorAgents } from '@server/a3/registry'

registerCollectorAgents()

function resolveSessionId(payload: Record<string, unknown>): string | null {
  const metadata = payload.metadata as Record<string, unknown> | undefined
  const sessionId = metadata?.sessionId
  if (typeof sessionId === 'string' && sessionId.length > 0) {
    return sessionId
  }
  const externalUserId = payload.externalUserId
  if (typeof externalUserId === 'string' && externalUserId.length > 0) {
    return externalUserId
  }
  return null
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-docuseal-signature')
  const hasSecret = env.docuSealWebhookSecret.length > 0

  if (hasSecret && !verifyHmacSignature(rawBody, signature, env.docuSealWebhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const parsedPayload = ConsentWebhookPayloadSchema.safeParse(JSON.parse(rawBody))
  if (!parsedPayload.success) {
    return NextResponse.json({ error: 'Invalid payload', issues: parsedPayload.error.flatten() }, { status: 400 })
  }

  const payload = parsedPayload.data
  const idempotencyStore = getIdempotencyStore()
  const eventId = `${payload.eventType}:${payload.documentId}:${payload.status}`
  const eventKey = crypto.createHash('sha256').update(eventId).digest('hex')

  if (await idempotencyStore.has('consent_webhook', eventKey)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  await idempotencyStore.mark('consent_webhook', eventKey)
  const sessionId = resolveSessionId(payload as unknown as Record<string, unknown>)
  if (!sessionId) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'No sessionId mapping' })
  }

  await applySessionStateUpdate(
    sessionId,
    {
      consentGiven: payload.status === 'completed',
      consentStatus: payload.status === 'completed' ? 'completed' : payload.status,
      consentDocumentId: payload.documentId,
    },
    'consent_agent',
  )

  await injectSystemEvent(sessionId, 'Consent webhook event received and processed.')

  return NextResponse.json({ ok: true })
}
