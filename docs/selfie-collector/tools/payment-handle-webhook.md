# tool.payment.handle_webhook.v1

## Purpose

Verify PayPal webhook signature and normalize transaction status events.

## Contract

- Input schema: `SignedWebhookEnvelopeSchema` + `PayPalWebhookPayloadSchema`
- Output schema: normalized payment event (`pending`, `authorized`, `paid`, `failed`, `expired`)
- Source of truth: `app/contracts/webhooks.ts`

## Error Taxonomy

- `PAYMENT_SIGNATURE_INVALID` (fatal)
- `PAYMENT_EVENT_DUPLICATE` (success/no-op)
- `PAYMENT_EVENT_INVALID` (fatal)

## Idempotency

- Idempotent by provider `eventId` and resource id.

## Provider Mapping

- Default: PayPal webhook format.
- Replacement impact: signature validation and status mapping only.
