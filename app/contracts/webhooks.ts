import { z } from 'zod'

export const SignedWebhookEnvelopeSchema = z.object({
  eventId: z.string(),
  timestamp: z.string(),
  signature: z.string(),
  provider: z.enum(['docuseal', 'paypal']),
  payload: z.record(z.string(), z.unknown()),
})

export const ConsentWebhookPayloadSchema = z.object({
  eventType: z.string(),
  documentId: z.string(),
  status: z.enum(['completed', 'rejected', 'expired']),
  externalUserId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const PayPalWebhookPayloadSchema = z.object({
  eventType: z.string(),
  eventVersion: z.string().optional(),
  resource: z.object({
    id: z.string(),
    status: z.string().optional(),
    custom_id: z.string().optional(),
    invoice_id: z.string().optional(),
  }),
  summary: z.string().optional(),
})

export type SignedWebhookEnvelope = z.infer<typeof SignedWebhookEnvelopeSchema>
export type ConsentWebhookPayload = z.infer<typeof ConsentWebhookPayloadSchema>
export type PayPalWebhookPayload = z.infer<typeof PayPalWebhookPayloadSchema>
