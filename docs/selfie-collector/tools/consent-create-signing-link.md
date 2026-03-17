# tool.consent.create_signing_link.v1

## Purpose

Create a signer-specific consent URL and provider document identifier.

## Contract

- Input schema: `CreateSigningLinkInputSchema`
- Output schema: `CreateSigningLinkOutputSchema`
- Source of truth: `app/contracts/tools.ts`

## Error Taxonomy

- `CONSENT_PROVIDER_TIMEOUT` (retryable)
- `CONSENT_PROVIDER_UNAVAILABLE` (retryable)
- `CONSENT_INVALID_REQUEST` (fatal)

## Idempotency

- Idempotent by (`sessionId`, `userId`, `consentTemplateVersion`).

## Provider Mapping

- Default: DocuSeal.
- Replacement impact: adapter implementation only.
