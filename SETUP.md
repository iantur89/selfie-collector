# Setup checklist — what you need to do

Follow in order. Steps you’ve already done (e.g. Terraform, IAM user) can be skipped.

---

## 1. AWS (already done if you ran Terraform)

- [x] Terraform applied: S3, DynamoDB (sessions + idempotency), SQS, CloudWatch log group exist.
- [ ] **If you added Bedrock to the policy file:** update the policy in AWS (once, with **admin** profile):

  From project root:

  ```powershell
  aws iam create-policy-version --policy-arn arn:aws:iam::420795649979:policy/DeployWebApps --policy-document file://infra/iam-policy-deploy-webapps.json --set-as-default --profile YOUR_ADMIN_PROFILE
  ```

  Replace `420795649979` with your account ID and `YOUR_ADMIN_PROFILE` with an admin profile.

---

## 2. Environment variables

Create a `.env` (or `.env.local`) in the project root with at least:

```env
# Required for production-style run (Terraform already created these)
AWS_REGION=us-east-1
DYNAMODB_SESSION_TABLE=selfie-collector-sessions
DYNAMODB_IDEMPOTENCY_TABLE=selfie-collector-idempotency
S3_ARTIFACT_BUCKET=selfie-data-collector-artifacts-dev
ENRICHMENT_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/420795649979/selfie-collector-enrichment

# App base URL (for consent/payment links and webhooks)
APP_BASE_URL=https://your-public-host.com

# Consent provider (modular; can be swapped)
CONSENT_PROVIDER=docuseal
DOCUSEAL_BASE_URL=https://your-docuseal-host.com
DOCUSEAL_API_KEY=your_docuseal_api_key
DOCUSEAL_TEMPLATE_ID=1000001
# Optional:
# DOCUSEAL_API_BASE_URL=https://your-docuseal-host.com/api
# DOCUSEAL_SUBMITTER_ROLE=Signer

# Optional: real LLM (omit for stub replies)
BEDROCK_MODEL_IDS=us.anthropic.claude-sonnet-4-5-20250929-v1:0
```

If the app runs on **EC2/ECS/Lambda** with an IAM role, the role needs the same permissions as the DeployWebApps policy (or a subset: DynamoDB, S3, SQS, Bedrock, Secrets Manager, etc.). No access keys in `.env` in that case.

If you run **locally** and want to use AWS resources, use the `selfie-data-collector` profile (see step 3) or set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in `.env`.

---

## 3. AWS credentials (for local or CI)

- [ ] **If not already done:** Create the IAM user and profile — see **infra/CREATE-USER-SELFIE-DATA-COLLECTOR.md** (create user, attach DeployWebApps, create access key, add `[profile selfie-data-collector]` to `~/.aws/config` and credentials to `~/.aws/credentials`).
- For local dev: `$env:AWS_PROFILE = "selfie-data-collector"` (or set in your shell profile).

---

## 4. PostgreSQL (optional but recommended for dashboard)

- [ ] Create a Postgres DB (e.g. RDS, or local).
- [ ] Set `POSTGRES_URL` in `.env` (e.g. `postgresql://user:pass@host:5432/dbname`).
- [ ] Run migrations:

  ```bash
  npm run db:init
  ```

  This applies `infra/sql/schema.sql`. Without `POSTGRES_URL`, the app uses in-memory storage for dataset/audit (lost on restart).

---

## 5. Telegram bot

- [ ] Create a bot via [@BotFather](https://t.me/BotFather), get the **bot token**.
- [ ] Store the token in AWS Secrets Manager (or in `.env` as `TELEGRAM_BOT_TOKEN` if you add that to the app).
- [ ] Set your app’s **webhook** to point at your server:

  ```text
  https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-public-host.com/api/telegram/webhook
  ```

  The app expects Telegram to POST updates to `POST /api/telegram/webhook`. The handler is in `app/server/telegram/handler.ts`; ensure the app sends replies back to Telegram (currently the handler returns a string; you may need to add a call to the Telegram Bot API to send the message — check whether that’s already wired in the webhook route).

- [ ] If the app doesn’t yet read `TELEGRAM_BOT_TOKEN` from env and call `sendMessage`, add that in the webhook route so the user sees the bot’s reply in Telegram.

---

## 6. DocuSeal (consent signatures)

- [ ] Sign up or self-host DocuSeal, get API base URL and webhook secret.
- [ ] Set in `.env`:
  - `CONSENT_PROVIDER=docuseal` (or `mock`; default is `auto`)
  - `DOCUSEAL_BASE_URL` (e.g. `https://your-docuseal.com`)
  - `DOCUSEAL_API_KEY`
  - `DOCUSEAL_TEMPLATE_ID`
  - Optional: `DOCUSEAL_API_BASE_URL` and `DOCUSEAL_SUBMITTER_ROLE`
  - `DOCUSEAL_WEBHOOK_SECRET` (for verifying consent webhooks)
- [ ] Configure DocuSeal to send completion webhooks to: `https://your-public-host.com/api/webhooks/consent`.
- [ ] When creating a signing link, pass enough context (e.g. `sessionId`) in metadata so the webhook handler can map the event to the right A3 session (see `app/api/webhooks/consent/route.ts` and `resolveSessionId`).

---

## 7. PayPal (payments)

- [ ] Create a PayPal app (sandbox or live), get client ID and secret.
- [ ] Set in `.env`:
  - `PAYPAL_WEBHOOK_SECRET` (for verifying payment webhooks)
  - Optionally `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` if the app uses them for creating checkouts.
- [ ] In PayPal Developer Dashboard, set webhook URL to: `https://your-public-host.com/api/webhooks/payment`.
- [ ] Ensure the payment adapter passes a stable identifier (e.g. `sessionId`) as `custom_id` (or similar) so the webhook can resolve the session (see `app/api/webhooks/payment/route.ts`).

---

## 8. Run the app

- [ ] Install and run:

  ```bash
  npm install
  npm run dev
  ```

  Or for production:

  ```bash
  npm run build
  npm run start
  ```

  Or run via Docker (see **infra/DEPLOYMENT.md**).

- [ ] Open `http://localhost:3000/chat` and (if configured) `http://localhost:3000/dataset`.
- [ ] Trigger the Telegram webhook (send a message to the bot) and confirm the app receives it and (if implemented) replies in Telegram.

---

## Quick reference

| Item | Where / value |
|------|----------------|
| Terraform outputs | `infra/terraform` → `terraform output` |
| IAM policy JSON | `infra/iam-policy-deploy-webapps.json` |
| IAM user + profile | `infra/CREATE-USER-SELFIE-DATA-COLLECTOR.md` |
| DB schema | `infra/sql/schema.sql`; apply with `npm run db:init` |
| Webhook routes | `/api/telegram/webhook`, `/api/webhooks/consent`, `/api/webhooks/payment` |

If something is already done (e.g. Terraform, IAM user, policy update), skip that step and continue from the next.
