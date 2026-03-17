# How to get all environment variable values

This guide explains where to obtain each value used in `.env` for the Selfie Data Collector app. Copy the names into your `.env` and fill in the values as you obtain them.

---

## Quick reference table

| Variable | Where to get it | Required for |
|----------|-----------------|--------------|
| `TELEGRAM_BOT_TOKEN` | [Telegram: BotFather](#telegram) | Telegram bot, photo download to S3 |
| `S3_ARTIFACT_BUCKET` | [AWS: S3](#aws) | Storing photos, Rekognition |
| `AWS_REGION` | Your AWS region (e.g. `us-east-1`) | AWS services |
| `DYNAMODB_SESSION_TABLE` | [AWS: Terraform / DynamoDB](#aws) | A3 sessions |
| `DYNAMODB_IDEMPOTENCY_TABLE` | [AWS: Terraform / DynamoDB](#aws) | Webhook idempotency |
| `ENRICHMENT_QUEUE_URL` | [AWS: Terraform / SQS](#aws) | Enrichment worker |
| `APP_BASE_URL` | Your app’s public URL | Consent/payment links, webhooks |
| `CONSENT_PROVIDER` | Choose: `auto`, `docuseal`, `mock` | Consent flow |
| `DOCUSEAL_BASE_URL` | [DocuSeal: your instance](#docuseal) | DocuSeal consent |
| `DOCUSEAL_API_KEY` | [DocuSeal: API console](#docuseal) | Creating signing links |
| `DOCUSEAL_TEMPLATE_ID` | [DocuSeal: template](#docuseal) | Creating signing links |
| `DOCUSEAL_WEBHOOK_SECRET` | [DocuSeal: webhook config](#docuseal) | Verifying consent webhooks |
| `DOCUSEAL_SUBMITTER_ROLE` | Your template’s role name (default `Signer`) | DocuSeal submissions |
| `DOCUSEAL_API_BASE_URL` | Only if API is at different URL (optional) | DocuSeal API |
| `PAYPAL_WEBHOOK_SECRET` | [PayPal: Developer Dashboard](#paypal) | Verifying payment webhooks |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | [PayPal: App credentials](#paypal) | Real checkout (optional) |
| `POSTGRES_URL` | Your Postgres connection string | Dataset/audit persistence (optional) |
| `BEDROCK_MODEL_IDS` | [AWS: Bedrock](#aws-bedrock) | Real LLM replies (optional) |

---

## Telegram

### `TELEGRAM_BOT_TOKEN`

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot` and follow the prompts (name and username for the bot).
3. BotFather replies with a token like `123456789:ABCdefGHI...`. That is your `TELEGRAM_BOT_TOKEN`.
4. **Security:** Do not commit this to git. Store it in `.env` (which is in `.gitignore`). If the token was ever exposed, use BotFather → your bot → **API Token** → **Revoke current token** and use the new one.

**Used for:** Receiving updates at `/api/telegram/webhook` and downloading photos via the Telegram Bot API so they can be stored in S3 and used by Rekognition.

---

## AWS

### `AWS_REGION`

- Use the region where your resources live, e.g. `us-east-1`, `eu-west-1`.
- Default in the app if unset: `us-east-1`.

### `S3_ARTIFACT_BUCKET`

- **Option A:** Create a bucket in the AWS Console (S3 → Create bucket). Note the bucket name (e.g. `selfie-data-collector-artifacts-dev`).
- **Option B:** If you use Terraform, run `terraform output` in `infra/terraform` and use the artifact bucket name from the outputs (if defined).
- The app uploads Telegram photos and other artifacts here; Rekognition reads images from this bucket.

### `DYNAMODB_SESSION_TABLE` and `DYNAMODB_IDEMPOTENCY_TABLE`

- **With Terraform:** In `infra/terraform`, run `terraform output` (or inspect `variables.tf` / `main.tf`) for the session and idempotency table names. Typical names: `selfie-collector-sessions`, `selfie-collector-idempotency`.
- **Without Terraform:** Create two DynamoDB tables in the AWS Console (or CLI). One is used for A3 session state, the other for idempotency keys (e.g. for webhooks and Telegram updates). Use the table names as the env values.

### `ENRICHMENT_QUEUE_URL`

- **With Terraform:** From `infra/terraform`, run `terraform output` for the SQS queue URL (e.g. `https://sqs.us-east-1.amazonaws.com/123456789012/selfie-collector-enrichment`).
- **Without Terraform:** Create an SQS queue in the same region and copy its URL from the console or CLI.

### `BEDROCK_MODEL_IDS` (optional)

- In **AWS Console** go to **Amazon Bedrock** → **Model access** (or **Foundation models**). Request access to a model (e.g. Claude).
- In the list, copy the **Model ID**, e.g. `us.anthropic.claude-sonnet-4-5-20250929-v1:0`. Set `BEDROCK_MODEL_IDS` to that value (comma-separated if you use multiple).
- If unset, the app uses a stub LLM (no real model calls).

---

## DocuSeal (consent)

Use these when `CONSENT_PROVIDER` is `docuseal` or `auto` (and you want to use DocuSeal).

### `DOCUSEAL_BASE_URL`

- **Self-hosted:** The URL where your DocuSeal instance is reachable, e.g. `https://docuseal.yourdomain.com` or `http://localhost:3000` if you run DocuSeal locally. No trailing slash.
- **Cloud:** Use the URL DocuSeal gives you (e.g. `https://cloud.docuseal.com` or similar).

### `DOCUSEAL_API_KEY`

1. Log in to your DocuSeal instance (self-hosted or cloud).
2. Open the user menu (e.g. your avatar/initials) → **API** or **Console** → **API**.
3. Create or copy an API key. Paste it into `DOCUSEAL_API_KEY`.
- **Self-hosted:** API is included; no paid plan required for this.

### `DOCUSEAL_TEMPLATE_ID`

1. In DocuSeal, create or open a **template** (the form users will sign for consent).
2. The template ID is shown in the template’s URL (e.g. `/templates/1000001`) or in the template settings/API. It’s a numeric ID like `1000001`.
3. Set `DOCUSEAL_TEMPLATE_ID` to that number. The template must have at least one submitter role (e.g. “Signer”).

### `DOCUSEAL_WEBHOOK_SECRET`

1. In DocuSeal go to **Webhooks** (or **Integrations** → Webhooks).
2. Click **New webhook** (or Add).
3. Set **URL** to your app’s consent webhook: `https://your-app-domain.com/api/webhooks/consent`.
4. Choose events that include “form completed” / “submission completed”.
5. Add a **secret** (or “Signing secret”): generate a long random string (e.g. with `openssl rand -hex 32`) and save it.
6. Set that exact string as `DOCUSEAL_WEBHOOK_SECRET` in `.env`. The app uses it to verify that webhook requests really come from DocuSeal.

### `DOCUSEAL_SUBMITTER_ROLE`

- This must match a **role name** defined in your DocuSeal template (e.g. “Signer”, “First Party”). Default in the app is `Signer`. If your template uses a different role, set `DOCUSEAL_SUBMITTER_ROLE` to that name.

### `DOCUSEAL_API_BASE_URL` (optional)

- Set only if the DocuSeal API is served at a different base URL than the main app. For example, if the UI is at `https://docuseal.example.com` but the API is at `https://docuseal.example.com/api`, set `DOCUSEAL_API_BASE_URL=https://docuseal.example.com/api`. If unset, the app tries `DOCUSEAL_BASE_URL` and `DOCUSEAL_BASE_URL/api` automatically.

---

## PayPal (payments)

### `PAYPAL_WEBHOOK_SECRET`

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Open your app (or create one) and go to **Webhooks**.
3. Add a webhook URL: `https://your-app-domain.com/api/webhooks/payment`.
4. Subscribe to the events you need (e.g. payment capture completed).
5. After saving, open the webhook and copy or generate the **Webhook ID** / **Signing secret**. Set it as `PAYPAL_WEBHOOK_SECRET` in `.env`. The app uses it to verify that webhook requests come from PayPal.

### `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (optional)

- In the same PayPal Developer Dashboard, open your app and copy the **Client ID** and **Secret** (Sandbox or Live). Set them as `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` if the app is updated to create real checkouts via the PayPal Orders API. Until then, the payment webhook can still be verified with just `PAYPAL_WEBHOOK_SECRET`.

---

## App URL

### `APP_BASE_URL`

- The public URL where your app is reachable, e.g. `https://your-app.example.com` or `http://localhost:3000` for local dev. Used for consent redirects, payment return URLs, and any links the app sends to users. No trailing slash.

---

## Optional: PostgreSQL

### `POSTGRES_URL`

- Create a PostgreSQL database (e.g. on RDS, Supabase, or locally). Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`. Set it as `POSTGRES_URL`. If unset, the app uses in-memory storage for dataset/audit (data is lost on restart). Apply the schema with `npm run db:init` (uses `infra/sql/schema.sql`).

---

## Summary checklist

- [ ] **Telegram:** Get token from @BotFather → `TELEGRAM_BOT_TOKEN`
- [ ] **AWS:** Region, S3 bucket, DynamoDB tables, SQS queue URL (and optionally Bedrock model ID)
- [ ] **App:** Set `APP_BASE_URL` to your app’s public URL
- [ ] **DocuSeal:** Base URL, API key, template ID, webhook URL + secret → `DOCUSEAL_*`
- [ ] **PayPal:** Webhook URL + signing secret → `PAYPAL_WEBHOOK_SECRET`
- [ ] **Optional:** `POSTGRES_URL`, `BEDROCK_MODEL_IDS`, `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`

After filling `.env`, restart the app so it picks up the new values.
