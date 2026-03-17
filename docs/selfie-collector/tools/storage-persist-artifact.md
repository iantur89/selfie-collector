# tool.storage.persist_artifact.v1

## Purpose

Persist binary artifacts to durable object storage and return canonical location.

## Contract

- Input schema: `PersistArtifactInputSchema`
- Output schema: `PersistArtifactOutputSchema`
- Source of truth: `app/contracts/tools.ts`

## Error Taxonomy

- `STORAGE_WRITE_FAILED` (retryable)
- `STORAGE_INVALID_INPUT` (fatal)
- `STORAGE_ACCESS_DENIED` (fatal)

## Idempotency

- Idempotent by (`bucket`, `key`) with overwrite policy disabled by default.

## Provider Mapping

- Default: AWS S3.
- Replacement impact: storage adapter implementation only.
