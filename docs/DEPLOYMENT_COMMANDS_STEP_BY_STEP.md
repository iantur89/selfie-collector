# Deployment Commands (Local Build -> Docker Save -> Copy -> EC2 Run)

This doc consolidates the exact commands used to deploy this app to your EC2 instance using a Docker image tarball transfer (`docker save` + `docker load`), while keeping disk usage low.

## Pre-reqs

1. You have Docker installed locally (and EC2 has Docker installed).
2. You have an EC2 SSH key file locally (example name: `selfie-shared-key.pem`).
3. EC2 has (or you upload) an `.env` file at `~/selfie-collector/.env`.

## A. Commit + push (only needed if you haven't pushed the latest code)

1.
```powershell
cd "c:\Users\iantu\side_projects\selfie-data-collector"
```

2.
```powershell
git status -sb
```

3. Stage the webhook fix:
```powershell
git add "app/api/webhooks/consent/route.ts"
```

4. Commit:
```powershell
$msg=@'
Normalize DocuSeal consent webhook payloads

Map DocuSeal completion webhook bodies into the internal consent schema so A3 can mark consent complete and proceed.
'@
git commit -m $msg
```

5.
```powershell
git push origin main
```

## B. Local: build container + export tarball

1.
```powershell
cd "c:\Users\iantu\side_projects\selfie-data-collector"
```

2. Set variables:
```powershell
$SSH_KEY="selfie-shared-key.pem"
$SSH_USER="ec2-user"
$EC2_HOST="ec2-3-88-220-252.compute-1.amazonaws.com"
$REMOTE_DIR="~/selfie-collector"
```

3. Create timestamp + tar name:
```powershell
$TS=Get-Date -Format 'yyyyMMdd-HHmmss'
$BUILD_TAG="selfie-app:build"; $LATEST_TAG="selfie-app:latest"; $TAR_NAME="selfie-app-build-$TS.tar"
```

4. Build:
```powershell
docker build --progress=plain -t $BUILD_TAG .
```

5. Export tarball:
```powershell
docker save $BUILD_TAG -o "$PWD\$TAR_NAME"
```

## C. Local -> EC2: copy `.env` + tarball

1. Ensure remote directory exists:
```powershell
ssh -i $SSH_KEY "$SSH_USER@$EC2_HOST" "mkdir -p $REMOTE_DIR"
```

2. Copy `.env` to EC2
```powershell
scp -i $SSH_KEY ".env" "${SSH_USER}@${EC2_HOST}:${REMOTE_DIR}/.env"
```

3. Copy tarball to EC2 home dir:
```powershell
scp -i $SSH_KEY "$PWD\$TAR_NAME" "${SSH_USER}@${EC2_HOST}:~/$TAR_NAME"
```

## D. On EC2: load the docker image + restart container

After SSH-ing into EC2 (or run these commands from an SSH session):

1. (Pick the tarball you uploaded; in your case you used the newest one.)
```bash
ls -lah ~/*.tar
```

2. Set TAR_NAME (example):
```bash
TAR_NAME="selfie-app-build-20260318-173603.tar"
```

3. Load the image:
```bash
sudo docker load -i ~/$TAR_NAME
```

4. If the container name already exists, remove it first:
```bash
sudo docker rm -f selfie-app
```

5. Run the container (uses EC2-side env file):
```bash
sudo docker run -d --name selfie-app -p 3000:3000 --env-file ~/selfie-collector/.env --restart unless-stopped selfie-app:latest
```

6. Confirm container is running:
```bash
sudo docker ps --format "{{.Names}}  {{.Status}}"
```

7. View logs:
```bash
sudo docker logs --tail 50 selfie-app
```

## E. Verify app endpoints

1. Check the chat page is reachable:
```bash
curl -sS http://localhost:3000/chat | head -n 5
```

2. Optional: hit consent webhook endpoint with a *test payload* (only for schema sanity):
```bash
curl -sS http://localhost:3000/api/webhooks/consent -X POST -H "Content-Type: application/json" -d '{"eventType":"test","documentId":"1","status":"completed","metadata":{"sessionId":"test"}}'
```

## F. Space cleanup (optional, after you confirm it works)

1. Remove uploaded tar from EC2 (saves disk):
```bash
rm -f ~/*.tar
```

2. Prune unused docker objects:
```bash
sudo docker image prune -f
sudo docker builder prune -f
```

## Notes (from your earlier debugging)

- The “405 Method Not Allowed” you saw when clicking DocuSeal submit happens when a browser tries to `GET` an endpoint that only implements `POST`.
- The real A3 workflow advancement comes from the DocuSeal server-to-server webhook `POST` to `/api/webhooks/consent`.
- This repo update makes the consent webhook more tolerant by normalizing DocuSeal webhook payloads into your internal schema and also adds a simple `GET` response to the consent endpoint to reduce redirect noise.

