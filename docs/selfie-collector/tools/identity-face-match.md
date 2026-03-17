# tool.identity.face_match.v1

## Purpose

Compare ID portrait and selfie embeddings to verify same-person match.

## Contract

- Input schema: `FaceMatchInputSchema`
- Output schema: `FaceMatchOutputSchema`
- Source of truth: `app/contracts/tools.ts`

## Error Taxonomy

- `FACE_MATCH_TIMEOUT` (retryable)
- `FACE_MATCH_UNAVAILABLE` (retryable)
- `FACE_MATCH_INVALID_INPUT` (fatal)

## Idempotency

- Idempotent by (`sessionId`, `userId`, `idImageS3Key`, `selfieImageS3Key`).

## Provider Mapping

- Default: InsightFace/ArcFace embeddings.
- Replacement impact: adapter implementation only.
