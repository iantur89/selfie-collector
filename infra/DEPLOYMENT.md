# Deployment Runbook (Single AWS Environment)

All AWS resources are created and managed using the **selfie-data-collector** IAM user and the **DeployWebApps** policy (`infra/iam-policy-deploy-webapps.json`). Ensure that user exists and the profile is configured (see `infra/CREATE-USER-SELFIE-DATA-COLLECTOR.md`).

## 1) Provision Infrastructure

Use the CLI profile that has the DeployWebApps policy (default: `selfie-data-collector`):

```bash
cd infra/terraform
terraform init
# Uses profile selfie-data-collector by default (set in variables.tf / terraform.tfvars)
terraform apply -var-file=terraform.tfvars
```

To use a different profile:

```bash
terraform apply -var-file=terraform.tfvars -var="aws_profile=your-profile"
# or set AWS_PROFILE before running
export AWS_PROFILE=selfie-data-collector
terraform apply -var-file=terraform.tfvars
```

## 2) Configure Application Secrets

Set these environment variables for the service runtime:

- `AWS_REGION`
- `DYNAMODB_SESSION_TABLE`
- `DYNAMODB_IDEMPOTENCY_TABLE`
- `S3_ARTIFACT_BUCKET`
- `POSTGRES_URL`
- `ENRICHMENT_QUEUE_URL`
- `DOCUSEAL_WEBHOOK_SECRET`
- `PAYPAL_WEBHOOK_SECRET`
- `BEDROCK_MODEL_IDS` (optional) — for A3 LLM via Bedrock; e.g. `us.anthropic.claude-sonnet-4-5-20250929-v1:0`

## 3) Database Setup

```bash
npm run db:init
```

## 4) Build and Run Container

```bash
docker build -t selfie-data-collector:latest .
docker run -p 3000:3000 --env-file .env selfie-data-collector:latest
```

## 5) Smoke Tests

- `GET /chat` page loads
- `GET /dataset` page loads
- `POST /api/chat` responds
- `POST /api/webhooks/consent` verifies signature and idempotency behavior
- `POST /api/webhooks/payment` verifies signature and idempotency behavior

## 6) Load Validation

Use `infra/load/k6-chat.js` to validate target concurrency (100 users).
