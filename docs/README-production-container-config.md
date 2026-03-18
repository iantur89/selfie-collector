# Production Container Config (EC2 + Docker)

This document describes the **production** container setup for the Selfie Data Collector on a **single EC2 instance**, using:

- **Caddy** for HTTPS routing on `80/443`
- **selfie-app** (this repository) for the chat + verification flow
- **DocuSeal** for consent + signature, proxied by Caddy

It also calls out common port/network pitfalls (especially the `0.0.0.0:80` conflict).

---

## 0) Assumptions

- Everything runs on **one EC2 instance**
- Caddy is the only service bound to host ports **80** and **443**
- `sslip.io` (or another dynamic DNS) points hostnames to your EC2 public IP
- You will run the containers with environment variables from `~/<repo>/.env`

---

## 1) Required host ports

These are the host ports you must have free for your production setup:

- `80/tcp` and `443/tcp`: reserved for **Caddy**
- `3000/tcp`: either used by **selfie-app** (host-mapped) or not needed (if you proxy via Docker networking)
- `8080/tcp`: used for **DocuSeal** when host-mapped (recommended when Caddy is already on `80`)

### Important

Do **not** run DocuSeal as `-p 80:80` (or `-p 80:3000`) when Caddy is already bound to `:80`.

If you do, Docker will fail with:

- `bind: address already in use`

---

## 2) Recommended Docker network

Create one shared Docker network so Caddy can reach containers by name:

```bash
sudo docker network create selfie-net || true
```

---

## 3) Container run commands

### A) selfie-app (this repo)

1. Build/pull the image (example):

```bash
sudo docker build -t selfie-app:latest .
```

2. Run the container (two supported approaches):

**Approach 1 (recommended): no host port mapping**
If your Caddy is configured to proxy to container names on `selfie-net`, you can run without `-p`:

```bash
sudo docker run -d \
  --name selfie-app \
  --network selfie-net \
  --env-file ~/selfie-collector/.env \
  --restart unless-stopped \
  selfie-app:latest
```

**Approach 2: host-map `3000`**
Useful if you proxy Caddy to `localhost:3000` instead of `selfie-app:3000`:

```bash
sudo docker run -d \
  --name selfie-app \
  --network selfie-net \
  -p 3000:3000 \
  --env-file ~/selfie-collector/.env \
  --restart unless-stopped \
  selfie-app:latest
```

### B) DocuSeal

Run DocuSeal **without** binding host `80`. The commonly used mapping is:

- host `8080` -> container `3000`

```bash
sudo docker run -d \
  --name docuseal \
  --network selfie-net \
  -p 8080:3000 \
  --restart unless-stopped \
  docuseal/docuseal:latest
```

If you prefer “no host mapping”, keep `--network selfie-net` and omit `-p 8080:3000` (then Caddy should proxy to `docuseal:3000`).

### C) Caddy (HTTPS reverse proxy)

Run Caddy with host ports `80/443` bound and mount a Caddyfile that defines your hostnames.

Your Caddy container must be on the same network as the upstream containers if you proxy to container names:

```bash
sudo docker run -d \
  --name caddy \
  --network selfie-net \
  -p 80:80 -p 443:443 \
  -v /path/to/Caddyfile:/etc/caddy/Caddyfile \
  --restart unless-stopped \
  caddy:latest
```

---

## 4) Caddy routing (example)

Replace the hostnames with your actual `sslip.io` values:

```caddyfile
app.3.88.220.252.sslip.io {
  reverse_proxy selfie-app:3000
}

docuseal.3.88.220.252.sslip.io {
  reverse_proxy docuseal:3000
}
```

Alternative: if you chose the host-mapping approach and want to proxy to `localhost`, you can do:

```caddyfile
docuseal.3.88.220.252.sslip.io {
  reverse_proxy 127.0.0.1:8080
}
```

---

## 5) Environment variables (what must be set)

`selfie-app` requires values from your `~/<repo>/.env`:

- `APP_BASE_URL` (used to generate consent/payment URLs and webhook targets)
- `DOCUSEAL_BASE_URL` (what DocuSeal is publicly reachable at)
- `TELEGRAM_BOT_TOKEN`
- `AWS_REGION`
- `S3_ARTIFACT_BUCKET`
- `DYNAMODB_SESSION_TABLE`
- `DYNAMODB_IDEMPOTENCY_TABLE`
- `ENRICHMENT_QUEUE_URL`
- Consent config: `CONSENT_PROVIDER`, `DOCUSEAL_API_KEY`, `DOCUSEAL_TEMPLATE_ID`, `DOCUSEAL_WEBHOOK_SECRET`, `DOCUSEAL_SUBMITTER_ROLE`
- Payment config: `PAYPAL_WEBHOOK_SECRET` (and optional PayPal credentials)

See `docs/HOWTO-env-values.md` for the variable-specific “how to get it”.

---

## 6) Verification / smoke checks

### From EC2

```bash
# selfie-app is reachable
curl -I http://localhost:3000

# docuseal is reachable (host-mapped variant)
curl -I http://localhost:8080

# check the Caddy container is healthy and routes are happening
sudo docker logs --tail 100 caddy
```

### From your laptop (TLS/hostnames)

```bash
curl -I https://app.3.88.220.252.sslip.io
curl -I https://docuseal.3.88.220.252.sslip.io
```

If you also configured consent webhooks, validate that:

- DocuSeal can reach the app consent webhook endpoint
- The app can receive DocuSeal webhook callbacks

---

## 7) Common production issues

### DocuSeal fails to start with “address already in use”

Cause: port `80` is already bound by Caddy.

Fix: re-run DocuSeal with `-p 8080:3000` (or proxy to container name on `selfie-net` without host binding).

---

## 8) Recommended operational workflow

1. Stop/restart containers in this order:
   - `selfie-app` (optional stop)
   - `docuseal` (if you changed DocuSeal)
   - keep Caddy running
2. When deploying a new app image, prefer replacing only the `selfie-app` container.
3. Tail logs:
   - `sudo docker logs -f selfie-app`
   - `sudo docker logs -f caddy`
   - `sudo docker logs -f docuseal` (when troubleshooting DocuSeal)

