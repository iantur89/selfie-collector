# How to deploy to EC2 (selfie-shared)

Single EC2 instance: **DocuSeal** on port 80, **selfie-app** on port 3000.

---

## Prerequisites

- EC2 instance running (e.g. `3.88.220.252`), with Docker installed.
- Repo cloned on the server: `~/selfie-collector` (from `iantur89/selfie-collector`).
- `.env` on the server with the same values as your local `.env` (or copy from local). **Do not commit `.env`.**

---

## 1. Deploy from your machine (push code)

```powershell
cd C:\Users\iantu\side_projects\selfie-data-collector
git add -A
git commit -m "Your message"
git push origin main
```

---

## 2. On the EC2 instance: pull and run

SSH in (use your key and EC2 IP):

```bash
ssh -i /path/to/selfie-shared-key.pem ec2-user@3.88.220.252
```

Then:

```bash
cd ~/selfie-collector

# Get latest code
git pull origin main

# Ensure .env exists and has APP_BASE_URL, DOCUSEAL_BASE_URL, Telegram, AWS, DocuSeal vars
# If you need to copy from local: from your Windows machine:
#   scp -i selfie-shared-key.pem .env ec2-user@3.88.220.252:~/selfie-collector/.env

# Stop and remove existing app container (if any)
sudo docker stop selfie-app 2>/dev/null; sudo docker rm selfie-app 2>/dev/null

# Build and run the app
sudo docker build -t selfie-app:latest .
sudo docker run -d --name selfie-app -p 3000:3000 --env-file .env --restart unless-stopped selfie-app:latest
```

---

## 3. DocuSeal (one-time or when you change it)

If DocuSeal is not running yet:

```bash
sudo docker run -d --name docuseal -p 80:80 --restart unless-stopped docuseal/docuseal
```

If it’s already running, no need to restart for a normal app deploy.

---

## 4. Quick one-liner (app only)

After SSH and `cd ~/selfie-collector`:

```bash
git pull origin main && sudo docker stop selfie-app 2>/dev/null; sudo docker rm selfie-app 2>/dev/null; sudo docker build -t selfie-app:latest . && sudo docker run -d --name selfie-app -p 3000:3000 --env-file .env --restart unless-stopped selfie-app:latest
```

---

## URLs

| Service     | URL                              |
|------------|-----------------------------------|
| DocuSeal   | http://3.88.220.252/              |
| Selfie app | http://3.88.220.252:3000/         |
| Consent webhook | http://3.88.220.252:3000/api/webhooks/consent |

Set these in DocuSeal (webhook URL) and in `.env` as `APP_BASE_URL` and `DOCUSEAL_BASE_URL`.
