# tool.dashboard.query_dataset.v1

## Purpose

Query enriched selfie dataset with faceted filters for dashboard inspection and export.

## Contract

- Input schema: `QueryDatasetInputSchema`
- Output schema: `QueryDatasetOutputSchema`
- Source of truth: `app/contracts/tools.ts`

## Error Taxonomy

- `QUERY_INVALID_FILTER` (fatal)
- `QUERY_TIMEOUT` (retryable)
- `QUERY_BACKEND_UNAVAILABLE` (retryable)

## Idempotency

- Pure read operation; deterministic for same filters and paging.

## Provider Mapping

- Default: PostgreSQL metadata store.
- Replacement impact: query adapter implementation only.
