# Tool Contracts

All tools are versioned, provider-agnostic contracts used by the A3 flow.

Rules:

- Contract names follow `tool.<domain>.<action>.v1`.
- Inputs and outputs are defined in `app/contracts/tools.ts`.
- Adapters may change providers, but contract names and schemas must remain stable.
- Any breaking change requires a new version suffix (`v2`).

## Tools

1. `tool.identity.verify_document_and_selfie.v1`
2. `tool.identity.face_match.v1`
3. `tool.consent.create_signing_link.v1`
4. `tool.consent.handle_webhook.v1`
5. `tool.payment.create_checkout.v1`
6. `tool.payment.handle_webhook.v1`
7. `tool.ingest.validate_selfie.v1`
8. `tool.enrichment.tag_selfie.v1`
9. `tool.storage.persist_artifact.v1`
10. `tool.dashboard.query_dataset.v1`
