# Selfie Data Collector

Built with [GenUI A3](https://www.npmjs.com/package/@genui-a3/core) + Next.js.

## Local Setup

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000/chat`
- `http://localhost:3000/dataset`

## Required Environment Variables

- `AWS_REGION`
- `DYNAMODB_SESSION_TABLE`
- `DYNAMODB_IDEMPOTENCY_TABLE`
- `S3_ARTIFACT_BUCKET`
- `POSTGRES_URL`
- `DOCUSEAL_WEBHOOK_SECRET`
- `PAYPAL_WEBHOOK_SECRET`

Optional (for real LLM responses):

- `BEDROCK_MODEL_IDS` — Comma-separated Bedrock model IDs (e.g. `us.anthropic.claude-sonnet-4-5-20250929-v1:0`). If set, the app uses AWS Bedrock instead of the stub provider. The deploy IAM policy includes `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream`.

Optional (consent provider):

- `CONSENT_PROVIDER` — `auto` (default), `docuseal`, or `mock`
- `DOCUSEAL_BASE_URL` — DocuSeal app URL (e.g. `https://docuseal.yourdomain.com`)
- `DOCUSEAL_API_BASE_URL` — Optional explicit API base URL; if omitted, app tries `${DOCUSEAL_BASE_URL}` and `${DOCUSEAL_BASE_URL}/api`
- `DOCUSEAL_API_KEY` — API key for creating submissions
- `DOCUSEAL_TEMPLATE_ID` — Template ID used for signature requests
- `DOCUSEAL_SUBMITTER_ROLE` — Role name in template (default: `Signer`)

## Webhook Endpoints

- `POST /api/telegram/webhook`
- `POST /api/webhooks/consent`
- `POST /api/webhooks/payment`

## Data and Infra

- SQL schema: `infra/sql/schema.sql`
- Terraform skeleton: `infra/terraform` — creates S3, DynamoDB, SQS, CloudWatch using the **selfie-data-collector** CLI profile (DeployWebApps policy). See `infra/CREATE-USER-SELFIE-DATA-COLLECTOR.md` to create that user and policy.
- CI/CD workflow: `.github/workflows/ci-cd.yml`
- Deployment runbook: `infra/DEPLOYMENT.md`
- Load test script (100 VUs): `infra/load/k6-chat.js`
