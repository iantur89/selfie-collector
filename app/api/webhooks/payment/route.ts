import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PayPalWebhookPayloadSchema } from '@contracts/webhooks'
import { env } from '@server/config/env'
import { getIdempotencyStore } from '@server/idempotency/store'
import { verifyHmacSignature } from '@server/webhooks/signature'
import { applySessionStateUpdate, injectSystemEvent } from '@server/a3/session'
import { registerCollectorAgents } from '@server/a3/registry'

registerCollectorAgents()

function mapPayPalStatus(status?: string): 'pending' | 'authorized' | 'paid' | 'failed' | 'expired' {
  const normalized = (status ?? '').toUpperCase()
  if (normalized.includes('COMPLETED')) return 'paid'
  if (normalized.includes('APPROVED')) return 'authorized'
  if (normalized.includes('FAILED') || normalized.includes('DENIED')) return 'failed'
  if (normalized.includes('EXPIRED')) return 'expired'
  return 'pending'
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-paypal-signature')
  const hasSecret = env.payPalWebhookSecret.length > 0

  if (hasSecret && !verifyHmacSignature(rawBody, signature, env.payPalWebhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const parsedPayload = PayPalWebhookPayloadSchema.safeParse(JSON.parse(rawBody))
  if (!parsedPayload.success) {
    return NextResponse.json({ error: 'Invalid payload', issues: parsedPayload.error.flatten() }, { status: 400 })
  }

  const payload = parsedPayload.data
  const eventId = `${payload.eventType}:${payload.resource.id}`
  const eventKey = crypto.createHash('sha256').update(eventId).digest('hex')
  const idempotencyStore = getIdempotencyStore()

  if (await idempotencyStore.has('payment_webhook', eventKey)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }
  await idempotencyStore.mark('payment_webhook', eventKey)

  const sessionId = payload.resource.custom_id ?? payload.resource.invoice_id
  if (!sessionId) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'No sessionId mapping' })
  }

  const mappedStatus = mapPayPalStatus(payload.resource.status)
  await applySessionStateUpdate(
    sessionId,
    {
      paymentCompleted: mappedStatus === 'paid',
      paymentStatus: mappedStatus,
      paymentTransactionId: payload.resource.id,
    },
    'payment_agent',
  )
  await injectSystemEvent(sessionId, 'Payment webhook event received and processed.')

  return NextResponse.json({ ok: true })
}
