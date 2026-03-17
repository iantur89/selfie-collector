# tool.payment.create_checkout.v1

## Purpose

Create a payment checkout URL and trackable transaction id.

## Contract

- Input schema: `CreatePayPalCheckoutInputSchema`
- Output schema: `CreatePayPalCheckoutOutputSchema`
- Source of truth: `app/contracts/tools.ts`

## Error Taxonomy

- `PAYMENT_PROVIDER_TIMEOUT` (retryable)
- `PAYMENT_PROVIDER_UNAVAILABLE` (retryable)
- `PAYMENT_INVALID_REQUEST` (fatal)

## Idempotency

- Idempotent by (`sessionId`, `userId`, `amount`, `currency`).

## Provider Mapping

- Default: PayPal Checkout.
- Replacement impact: adapter implementation only.
