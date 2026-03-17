# tool.ingest.validate_selfie.v1

## Purpose

Validate that an uploaded image is an acceptable selfie sample for ingestion.

## Contract

- Input schema: `ValidateSelfieInputSchema`
- Output schema: `ValidateSelfieOutputSchema`
- Source of truth: `app/contracts/tools.ts`

## Error Taxonomy

- `INGEST_IMAGE_UNREADABLE` (fatal)
- `INGEST_NOT_A_SELFIE` (fatal)
- `INGEST_VALIDATION_TIMEOUT` (retryable)

## Idempotency

- Idempotent by (`sessionId`, `userId`, `selfieS3Key`).

## Provider Mapping

- Default: open-source selfie classifier pipeline.
- Replacement impact: adapter implementation only.
