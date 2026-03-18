import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ConsentWebhookPayloadSchema } from '@contracts/webhooks'
import { env } from '@server/config/env'
import { getIdempotencyStore } from '@server/idempotency/store'
import { verifyHmacSignature } from '@server/webhooks/signature'
import { createCollectorSession } from '@server/a3/session'
import { registerCollectorAgents } from '@server/a3/registry'
import { withSessionLock } from '@server/session/sessionLock'
import { collectorInitialState } from '@agents/collector'
import { sendTelegramMessage } from '@server/telegram/sendMessage'

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
  // DocuSeal often redirects the user's browser to `completed_redirect_url`.
  // A3 progress still happens from the real `POST /api/webhooks/consent` server-to-server webhook.
  return new NextResponse(
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Consent received</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:40px;line-height:1.4}
      .card{max-width:640px;border:1px solid #e5e7eb;border-radius:14px;padding:20px 22px}
      .ok{display:inline-block;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;padding:4px 10px;border-radius:999px;font-weight:600}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="ok">Consent received</div>
      <h1>Thanks.</h1>
      <p>This page is just a browser confirmation. Your session will be updated automatically.</p>
    </div>
  </body>
</html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
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
  const sessionId = resolveSessionId(consentPayload as unknown as Record<string, unknown>)
  if (!sessionId) {
    console.warn('[ConsentWebhook] No sessionId in payload; DocuSeal must send metadata.sessionId (or externalUserId).')
    return NextResponse.json({ ok: true, ignored: true, reason: 'No sessionId mapping' })
  }

  const idempotencyStore = getIdempotencyStore()
  // Deduplicate by semantic completion identity, regardless of provider-specific event naming.
  const eventId = `${sessionId}:${consentPayload.documentId}:${consentPayload.status}`
  const eventKey = crypto.createHash('sha256').update(eventId).digest('hex')

  const claimed = await idempotencyStore.claim('consent_webhook', eventKey)
  if (!claimed) {
    console.log('[ConsentWebhook] Duplicate ignored', {
      sessionId,
      documentId: consentPayload.documentId,
      status: consentPayload.status,
    })
    return NextResponse.json({ ok: true, duplicate: true })
  }

  console.log('[ConsentWebhook] POST received', { sessionId, documentId: consentPayload.documentId, status: consentPayload.status })
  const webhookResult = {
    replyToSend: null as string | null,
    telegramChatId: null as number | null,
  }

  await withSessionLock(sessionId, async () => {
    const session = createCollectorSession(sessionId)
    const existing = await session.getSessionData()
    const existingState = (existing?.state ?? collectorInitialState) as Record<string, unknown>

    await session.upsertSessionData({
      // Ensure the A3 Consent agent evaluates the newly updated consent fields
      activeAgentId: 'consent_agent' as any,
      state: {
        ...existingState,
        consentGiven: consentPayload.status === 'completed',
        consentStatus: consentPayload.status === 'completed' ? 'completed' : consentPayload.status,
        consentDocumentId: consentPayload.documentId,
      } as any,
    })

    // Trigger A3 routing/transition based on updated state
    const result = await session.send('User has submitted the consent form.')
    webhookResult.replyToSend = result.responseMessage ?? null
    const state = result.state as Record<string, unknown> | undefined
    const chatIdFromState = state?.telegramChatId
    if (typeof chatIdFromState === 'string') {
      webhookResult.telegramChatId = parseInt(chatIdFromState, 10)
    } else if (typeof chatIdFromState === 'number') {
      webhookResult.telegramChatId = chatIdFromState
    } else if (sessionId.startsWith('tg-')) {
      webhookResult.telegramChatId = parseInt(sessionId.replace(/^tg-/, ''), 10)
    }
  })

  if (
    webhookResult.replyToSend &&
    webhookResult.telegramChatId != null &&
    !Number.isNaN(webhookResult.telegramChatId)
  ) {
    await sendTelegramMessage(webhookResult.telegramChatId, webhookResult.replyToSend)
  }

  return NextResponse.json({ ok: true })
}
