# Selfie Data Collector - Requirements Specification v2 (A3 + AWS)

## 1) Purpose and Scope

This document defines the new production requirements for a Telegram-based selfie data collection system built with A3. It supersedes the prior demo-focused spec and aligns with the target flow in `docs/selfie-collector/a3_sequence_and_ingest.md`.

Mandatory outcomes:

- Use `@genui-a3/core` from npm (no local A3 dependency).
- Implement a real onboarding flow: ID + selfie verification, consent signature, payment, ingest, and dataset inspection.
- Persist full user state and full conversation history across restarts and across horizontally scaled instances.
- Support many concurrent users and many concurrent chats safely.
- Tag each accepted selfie with machine-generated metadata for filtering/indexing in an interactive dashboard.
- Define tool contracts and integration docs so each provider can be swapped without changing the core A3 flow.

## 2) Target End-to-End Flow

The required journey is:

1. User starts in Telegram (`/start`).
2. Bot collects basic profile data (for example name).
3. Bot requests ID document + selfie.
4. System validates:
   - selfie image detection,
   - ID document detection,
   - face match between ID portrait and selfie.
5. If verified, bot transitions to consent.
6. Bot sends a consent link for digital signature.
7. Signature provider calls webhook; consent is marked complete and evidence is stored.
8. Bot transitions to payment setup and sends payment link.
9. Payment provider webhook confirms payment success.
10. Bot transitions to ingest flow and collects selfies (minimum 5, maximum 20).
11. Each selfie is validated, stored, and tagged (demographic predictions + image attributes).
12. User can finish when threshold is met (or auto-finish at max).
13. Dataset appears in dashboard with searchable/filterable facets.

## 3) A3 Architecture and Best Practices

1. Telegram remains a thin adapter:
   - stable `sessionId` per chat (for example `tg-<chatId>`),
   - normalize Telegram updates into one message string per turn,
   - call `session.send(message)` via the flow handler.
2. A3 orchestrates multi-agent routing; no hardcoded external state machine.
3. Use explicit agents aligned to flow stages:
   - `onboarding_orchestrator`,
   - `id_verify_agent`,
   - `consent_agent`,
   - `payment_agent`,
   - `ingest_agent`,
   - `completion_agent`.
4. Tool invocation contract must be structured and versioned (not brittle prompt-only strings).
5. External events (signature completed, payment completed) must be injected into the same A3 session using synthetic system messages and/or session upserts, then routed through the active agent.

## 4) Persistent State, Multi-User Concurrency, and Auditability

### 4.1 Session Persistence (Required)

1. `MemorySessionStore` is not allowed in production runtime.
2. Implement durable `SessionStore` backend (DynamoDB preferred for session store).
3. Session data must persist:
   - active agent id,
   - full shared A3 state,
   - complete message history.
4. Sessions must survive:
   - process restart,
   - deployment rollout,
   - scale-out to multiple instances.

### 4.2 Per-User Records (Required)

In addition to A3 session store, maintain application data tables for:

- user identity status and verification artifacts,
- consent status + signed document evidence,
- payment lifecycle and provider transaction ids,
- selfie assets and enrichment tags,
- full bot transcript exportable per user (for dispute/audit).

### 4.3 Concurrency and Idempotency (Required)

1. Multiple users and chats must be processed in parallel safely.
2. Every inbound webhook/event must be idempotent (provider event id dedupe).
3. Telegram update handling must prevent race conditions per session (session-level lock or optimistic concurrency with retries).
4. Duplicate messages or webhook retries must not create duplicate payments, duplicate consent records, or duplicate selfie records.

## 5) Data and Storage Requirements

### 5.1 Object Storage

1. All raw user assets (ID image, selfie images, signed consent PDF, optional exports) must be stored in S3.
2. No local-disk-only persistence for production data.
3. S3 object keys must be deterministic and traceable (`environment/userId/sessionId/artifactType/timestamp-hash`).

### 5.2 Metadata Store

1. Use a queryable metadata store for dashboard filtering (PostgreSQL preferred for flexible faceted queries).
2. Metadata must link to S3 object keys and include provenance (tool/model version, confidence scores, processing timestamps).
3. Keep immutable event records for critical transitions:
   - ID verified/rejected,
   - consent completed,
   - payment completed/failed,
   - selfie accepted/rejected.

### 5.3 Retention and Privacy

1. Define retention periods for:
   - raw ID artifacts,
   - selfies,
   - transcripts,
   - consent evidence.
2. Support hard delete by user id and legal hold exceptions.
3. Encrypt at rest and in transit; restrict access by least privilege IAM.

## 6) Selfie Enrichment and Tagging Requirements

Each accepted selfie must be enriched with tags for dashboard indexing.

Required tag families:

1. `demographics` (model-derived; include confidence):
   - coarse ethnicity/race class (if legally permitted),
   - age bucket,
   - optional demographic buckets configured per policy.
2. `gender` (model-derived with confidence and "unknown" class).
3. `lighting`:
   - `dark`, `normal`, `bright` (with luminance score).
4. `angle`:
   - `frontal`, `left`, `right`, `up`, `down`, `high_angle`, `low_angle` (from pose estimation).
5. `quality`:
   - blur score, occlusion flag, resolution bucket.

Governance:

- Every model output must store model name/version and confidence.
- Low-confidence classifications must be marked as uncertain, not forced.
- Sensitive demographic tagging must be feature-flagged by environment and jurisdiction.

## 7) Interactive Dashboard Requirements

The dashboard must support dataset browsing and faceted filtering across all enrichment tags and workflow states.

Minimum capabilities:

1. Filter by combinations such as:
   - only `high_angle`,
   - only `dark` lighting,
   - only selected demographic classes,
   - only selected gender class,
   - only paid + consented + verified.
2. Thumbnail grid with drill-down to sample detail.
3. Detail view includes:
   - image,
   - all tags and confidences,
   - user/session linkage (internal ids),
   - processing trace (tool/model versions).
4. Export filtered metadata (CSV/JSON) with access controls.
5. Role-based access (admin/reviewer) and audit log of dashboard queries/exports.

## 8) Tool Abstraction and Replaceability Requirements

The system must isolate each external capability behind internal tool interfaces so providers can be replaced with minimal changes.

### 8.1 Required Internal Tool Contracts

Define versioned interface docs for each tool:

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

Each contract must include:

- purpose,
- input schema,
- output schema,
- error taxonomy,
- idempotency behavior,
- auth/signature requirements,
- provider-specific mapping notes.

### 8.2 Tool Documentation Deliverables

Create/maintain one markdown file per tool under:

- `docs/selfie-collector/tools/<tool-name>.md`

Each file must contain:

- interface version and changelog,
- request/response examples,
- webhook payload example (if relevant),
- replacement guide ("if changing provider X to Y, only adapter changes here").

## 9) Provider Decisions and Recommendations

### 9.1 ID Verification and Face Match (Open Source First)

Approved direction:

- Use open-source models/pipelines for:
  - selfie-vs-non-selfie classification,
  - ID/passport detection/classification,
  - face matching between ID face and selfie.

Recommended stack (initial):

- detection/classification: YOLO-based document classifier + OCR parser where needed,
- face embedding/match: InsightFace (ArcFace embeddings) with calibrated thresholding.

### 9.2 Payment

Primary v1 decision:

- Use PayPal Checkout with webhook-confirmed payment status.

Lower-friction alternative to evaluate:

- Stripe Payment Links (often lower friction for card checkout because no PayPal account expectation).

Requirement:

- Payment adapter must make provider switch feasible without A3 flow changes.

### 9.3 Digital Signature

Recommended low-cost webhook-friendly solution:

- DocuSeal (self-hosted open-source or managed cloud) for signed consent flows and completion webhooks.

Alternatives:

- SignWell or Dropbox Sign if managed SaaS is preferred over self-hosting.

## 10) Security, Compliance, and Trust Controls

1. Verify signatures on all consent/payment webhooks.
2. Enforce replay protection (`timestamp` window + nonce/event-id dedupe).
3. Never trust plain `chat_id` as proof of consent/payment.
4. Store consent evidence:
   - signed document hash,
   - signer metadata,
   - consent template version,
   - completion timestamp.
5. Apply strict access controls and auditable access to PII data.

## 11) Deployment and Cloud Infrastructure Requirements

### 11.1 Environments and Release Topology

1. The platform must run at least three isolated AWS environments:
   - `dev`,
   - `staging`,
   - `prod`.
2. Each environment must use isolated resources (separate DB, buckets, secrets, and compute services).
3. Promotion path must be `dev -> staging -> prod` with explicit approval gates.
4. Production deploys must support rolling or blue/green strategies with zero-downtime target for bot + dashboard.

### 11.2 Reference AWS Architecture

1. **Compute**:
   - ECS Fargate service for Telegram webhook + A3 orchestration API,
   - optional separate worker service for async enrichment and heavy image processing,
   - optional queue consumer service for webhook/event processing.
2. **Data plane**:
   - S3 for binary artifacts (ID images, selfies, consent files),
   - DynamoDB for A3 session persistence (session state/history),
   - PostgreSQL (RDS/Aurora) for queryable metadata and dashboard facets,
   - SQS for decoupled asynchronous jobs and retry buffering.
3. **Edge and ingress**:
   - API Gateway or ALB in front of webhook/API endpoints,
   - TLS termination with ACM certificates,
   - WAF on internet-exposed endpoints.

### 11.3 Networking and Security Boundary

1. Use a VPC with public and private subnets across at least two AZs.
2. Internet-facing components (ALB/API Gateway, NAT) must be limited to required paths only.
3. ECS services, RDS, and internal data services must run in private subnets.
4. Security groups must enforce least-privilege east-west traffic.
5. Outbound egress must explicitly allow only required external providers (Telegram, PayPal, signature provider, model endpoints).

### 11.4 Infrastructure as Code

1. All infrastructure must be managed as code (Terraform, AWS CDK, or CloudFormation).
2. No manual console-only infrastructure in production.
3. IaC must include:
   - networking,
   - compute,
   - storage,
   - IAM policies/roles,
   - alarms/dashboards,
   - backup and retention policies.
4. IaC changes must be peer-reviewed and validated in CI before apply.

### 11.5 CI/CD and Artifact Management

1. Build immutable Docker images and publish to ECR.
2. CI must run:
   - lint/type checks,
   - unit/integration tests,
   - migration validation,
   - security scans (dependency + container image).
3. CD must support automatic rollback on failed health checks.
4. Database schema migrations must be versioned, reversible when possible, and run in deployment workflow with guardrails.
5. Release metadata (git SHA, image tag, migration version) must be traceable in runtime logs.

### 11.6 Configuration, Secrets, and Key Management

1. Secrets must be stored in AWS Secrets Manager:
   - Telegram bot token,
   - PayPal credentials,
   - signature provider keys,
   - DB credentials,
   - webhook signing secrets.
2. Non-secret configuration must be stored in SSM Parameter Store.
3. Encryption keys must be managed with AWS KMS; rotate keys per policy.
4. Secret rotation strategy must be documented and tested at least in staging.

### 11.7 Reliability, Scaling, and Performance

1. Services must scale horizontally based on CPU, memory, request rate, and queue depth.
2. Webhook handlers must respond quickly and offload heavy tasks to async workers/queues.
3. Define SLO targets (initial recommendation):
   - API/webhook availability >= 99.9% monthly,
   - p95 webhook processing latency <= 2s for synchronous path,
   - async enrichment completion <= 5 minutes p95.
4. Implement graceful degradation:
   - queue backlog handling,
   - provider outage retries with backoff,
   - user-safe fallback messaging.

### 11.8 Observability and Operations

1. Structured logs must include `sessionId`, `userId`, `chatId`, `eventId`, `toolName`, and deploy version.
2. Metrics must cover:
   - onboarding conversion funnel,
   - consent completion rate,
   - payment completion rate,
   - ingest acceptance/rejection rates,
   - enrichment latency and failure rates,
   - dashboard query latency.
3. Distributed tracing must include external calls and queue hops.
4. Alerting must include severity tiers and on-call routing for:
   - webhook signature failures spike,
   - payment callback failures,
   - queue age/backlog threshold breach,
   - DB/storage error rates.
5. Runbooks must exist for common incidents (provider outage, queue backlog, failed deployment, DB saturation).

### 11.9 Backup, Disaster Recovery, and Data Lifecycle

1. Enable automated DB backups and point-in-time recovery.
2. Enable S3 versioning where needed and lifecycle policies for archival/deletion.
3. Define and document DR targets:
   - RPO (data loss window),
   - RTO (service restore time).
4. Test restore procedures at least quarterly in non-prod.
5. Ensure deletion workflows comply with retention policies and legal constraints.

### 11.10 Cost and Capacity Governance

1. Tag all AWS resources with `project`, `environment`, `owner`, and `cost-center`.
2. Set AWS Budgets alarms per environment.
3. Use autoscaling bounds and right-sizing reviews to control costs.
4. Separate cost reporting for inference/enrichment workloads vs core bot/webhook workloads.

## 12) Testing and Acceptance Criteria

### 12.1 Required Tests

1. Unit tests for agent routing, tool adapters, and schema validation.
2. Integration tests for:
   - complete onboarding flow,
   - webhook retries/duplicates,
   - concurrent users/chats,
   - payment and signature sandbox callbacks.
3. Data tests for tagging quality and confidence threshold behavior.

### 12.2 Definition of Done

1. Production uses npm `@genui-a3/core` only.
2. Per-user state and complete transcript persist across restarts and across multiple service instances.
3. Consent and payment are webhook-authenticated and auditable.
4. Selfie tagging is persisted with confidence and model provenance.
5. Dashboard can filter by combinations of angle, lighting, demographics, and gender.
6. Tool contract docs exist for every required tool and enable provider replacement.

## 13) Delivery Phases

Phase 1: Contracts + persistence foundation  
Phase 2: ID/consent/payment real integrations  
Phase 3: ingest + enrichment pipeline  
Phase 4: dashboard + faceted search  
Phase 5: security hardening + load tests + rollout

