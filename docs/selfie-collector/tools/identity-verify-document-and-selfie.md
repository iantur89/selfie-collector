# tool.identity.verify_document_and_selfie.v1

## Purpose

Classify whether uploaded files are valid ID + selfie artifacts and return a verification outcome.

## Contract

- Input schema: `VerifyDocumentAndSelfieInputSchema`
- Output schema: `VerifyDocumentAndSelfieOutputSchema`
- Source of truth: `app/contracts/tools.ts`

## Error Taxonomy

- `IDENTITY_MODEL_TIMEOUT` (retryable)
- `IDENTITY_MODEL_UNAVAILABLE` (retryable)
- `IDENTITY_INVALID_INPUT` (fatal)
- `IDENTITY_LOW_CONFIDENCE` (fatal/inconclusive)

## Idempotency

- Idempotent by (`sessionId`, `userId`, `idImageS3Key`, `selfieImageS3Key`).

## Provider Mapping

- Default: open-source classifier pipeline.
- Replacement impact: adapter implementation only; A3 flow unchanged.
