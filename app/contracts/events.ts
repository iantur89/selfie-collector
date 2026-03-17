import { z } from 'zod'

export const EventKindSchema = z.enum([
  'telegram.message.received',
  'identity.verification.completed',
  'consent.webhook.received',
  'payment.webhook.received',
  'selfie.accepted',
  'selfie.rejected',
  'selfie.enriched',
  'dashboard.export.created',
])

export const AuditEventSchema = z.object({
  eventId: z.string(),
  eventKind: EventKindSchema,
  sessionId: z.string(),
  userId: z.string().optional(),
  chatId: z.string().optional(),
  occurredAt: z.string(),
  source: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const IdempotencyRecordSchema = z.object({
  idempotencyKey: z.string(),
  scope: z.enum(['telegram_update', 'consent_webhook', 'payment_webhook', 'ingest_upload']),
  firstSeenAt: z.string(),
  processedAt: z.string().optional(),
})

export type AuditEvent = z.infer<typeof AuditEventSchema>
export type IdempotencyRecord = z.infer<typeof IdempotencyRecordSchema>
