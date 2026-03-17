# tool.enrichment.tag_selfie.v1

## Purpose

Generate normalized metadata tags for selfie indexing (demographics, gender, lighting, angle, quality).

## Contract

- Input schema: `TagSelfieInputSchema`
- Output schema: `TagSelfieOutputSchema`
- Source of truth: `app/contracts/tools.ts`

## Error Taxonomy

- `ENRICHMENT_MODEL_TIMEOUT` (retryable)
- `ENRICHMENT_MODEL_UNAVAILABLE` (retryable)
- `ENRICHMENT_INVALID_INPUT` (fatal)

## Idempotency

- Idempotent by (`sessionId`, `userId`, `selfieS3Key`).

## Provider Mapping

- Default: open-source CV model ensemble.
- Replacement impact: adapter implementation only.
