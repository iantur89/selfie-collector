# tool.consent.handle_webhook.v1

## Purpose

Validate DocuSeal webhook signatures and normalize signature status updates.

## Contract

- Input schema: `SignedWebhookEnvelopeSchema` + `ConsentWebhookPayloadSchema`
- Output schema: normalized consent event (`completed`, `rejected`, `expired`)
- Source of truth: `app/contracts/webhooks.ts`

## Error Taxonomy

- `CONSENT_SIGNATURE_INVALID` (fatal)
- `CONSENT_EVENT_DUPLICATE` (success/no-op)
- `CONSENT_EVENT_INVALID` (fatal)

## Idempotency

- Idempotent by provider `eventId`.

## Provider Mapping

- Default: DocuSeal webhook format.
- Replacement impact: signature validation and field mapping only.
