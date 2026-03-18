import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ConsentWebhookPayloadSchema } from '@contracts/webhooks'
import { env } from '@server/config/env'
import { getIdempotencyStore } from '@server/idempotency/store'
import { verifyHmacSignature } from '@server/webhooks/signature'
import { applySessionStateUpdate, injectSystemEvent } from '@server/a3/session'
import { registerCollectorAgents } from '@server/a3/registry'

registerCollectorAgents()

type DocuSealConsentStatus = 'completed' | 'rejected' | 'expired'

function mapDocuSealToConsentStatus(eventType: string, statusRaw: unknown): DocuSealConsentStatus | null {
  const status = typeof statusRaw === 'string' ? statusRaw : ''
  const normalizedEvent = eventType.toLowerCase()
  const normalizedStatus = status.toLowerCase()

  // DocuSeal "form" webhooks typically use: completed, declined, opened, sent, awaiting.
  if (normalizedStatus.includes('completed') || normalizedEvent.includes('completed')) return 'completed'
  if (
    normalizedStatus.includes('declined') ||
    normalizedStatus.includes('rejected') ||
    normalizedEvent.includes('declined')
  )
    return 'rejected'
  if (normalizedStatus.includes('expired') || normalizedEvent.includes('expired')) return 'expired'

  return null
}

function normalizeDocuSealConsentPayload(raw: unknown): unknown | null {
  if (raw == null || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  // If it already matches our internal schema, keep it.
  const direct = ConsentWebhookPayloadSchema.safeParse(obj)
  if (direct.success) return direct.data

  const eventType =
    (typeof obj.eventType === 'string' ? obj.eventType : null) ??
    (typeof obj.event_type === 'string' ? obj.event_type : null) ??
    ''

  const data = (obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >

  const status = mapDocuSealToConsentStatus(eventType, data.status ?? obj.status)
  if (!status) return null

  const submission =
    data.submission && typeof data.submission === 'object'
      ? (data.submission as Record<string, unknown>)
      : ({} as Record<string, unknown>)

  const documentIdCandidate =
    (typeof submission.id === 'string' || typeof submission.id === 'number') ? submission.id :
    (typeof submission.submission_id === 'string' || typeof submission.submission_id === 'number') ? submission.submission_id :
    (typeof data.id === 'string' || typeof data.id === 'number') ? data.id :
    (typeof obj.id === 'string' || typeof obj.id === 'number') ? obj.id :
    null

  if (documentIdCandidate == null) return null
  const documentId = String(documentIdCandidate)

  const metadataRaw = data.metadata
  const metadata = metadataRaw && typeof metadataRaw === 'object' ? (metadataRaw as Record<string, unknown>) : {}

  const externalUserId = typeof data.external_id === 'string' ? data.external_id : undefined

  return {
    eventType,
    documentId,
    status,
    externalUserId,
    metadata,
  }
}

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

// Allow simple browser redirects to this endpoint without a noisy 405.
export async function GET() {
  return NextResponse.json({ ok: true, note: 'POST /api/webhooks/consent is required.' })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-docuseal-signature')
  const hasSecret = env.docuSealWebhookSecret.length > 0

  if (hasSecret && !verifyHmacSignature(rawBody, signature, env.docuSealWebhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const directParsed = ConsentWebhookPayloadSchema.safeParse(parsedJson)
  const normalized = directParsed.success ? directParsed.data : normalizeDocuSealConsentPayload(parsedJson)

  const payload = ConsentWebhookPayloadSchema.safeParse(normalized)
  if (!payload.success) {
    return NextResponse.json({ error: 'Invalid payload', issues: payload.error.flatten() }, { status: 400 })
  }

  const consentPayload = payload.data
  const idempotencyStore = getIdempotencyStore()
  const eventId = `${consentPayload.eventType}:${consentPayload.documentId}:${consentPayload.status}`
  const eventKey = crypto.createHash('sha256').update(eventId).digest('hex')

  if (await idempotencyStore.has('consent_webhook', eventKey)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  await idempotencyStore.mark('consent_webhook', eventKey)
  const sessionId = resolveSessionId(consentPayload as unknown as Record<string, unknown>)
  if (!sessionId) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'No sessionId mapping' })
  }

  await applySessionStateUpdate(
    sessionId,
    {
      consentGiven: consentPayload.status === 'completed',
      consentStatus: consentPayload.status === 'completed' ? 'completed' : consentPayload.status,
      consentDocumentId: consentPayload.documentId,
    },
    'consent_agent',
  )

  await injectSystemEvent(sessionId, 'Consent webhook event received and processed.')

  return NextResponse.json({ ok: true })
}
