#!/usr/bin/env bash
set -euo pipefail

# Builds locally, saves to a tarball, scp's to EC2, docker load's there, and restarts `selfie-app`.
# Optionally commits/pushes first.

# ---------- config (override via env vars) ----------
REPO_DIR="${REPO_DIR:-$(pwd)}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"

SSH_USER="${SSH_USER:-ec2-user}"
EC2_HOST="${EC2_HOST:-ec2-3-88-220-252.compute-1.amazonaws.com}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$REPO_DIR/selfie-shared-key.pem}"

REMOTE_DIR="${REMOTE_DIR:-~/selfie-collector}"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-$REMOTE_DIR/.env}"

BUILD_TAG="${BUILD_TAG:-selfie-app:build}"
LATEST_TAG="${LATEST_TAG:-selfie-app:latest}"

COPY_ENV_TO_EC2="${COPY_ENV_TO_EC2:-false}"   # true/false
NO_CACHE="${NO_CACHE:-false}"                 # true/false
KEEP_TAR="${KEEP_TAR:-false}"               # true/false

# ---------- args ----------
COMMIT_MESSAGE="${1:-}"
if [[ -z "$COMMIT_MESSAGE" ]]; then
  echo "Usage: $0 \"Commit message\""
  exit 1
fi

# ---------- helpers ----------
run() { echo "+ $*"; "$@"; }

cleanup_local_tar() {
  if [[ -f "${TAR_PATH_LOCAL:-}" ]] && [[ "${KEEP_TAR:-false}" != "true" ]]; then
    rm -f "$TAR_PATH_LOCAL" || true
  fi
}

cleanup_remote_tar() {
  if [[ -n "${tar_remote_cleanup_cmd:-}" ]]; then
    eval "$tar_remote_cleanup_cmd" || true
  fi
}

# ---------- preflight ----------
if [[ ! -d "$REPO_DIR" ]]; then
  echo "RepoDir not found: $REPO_DIR"
  exit 1
fi
if [[ ! -f "$SSH_KEY_PATH" ]]; then
  echo "SSH key not found: $SSH_KEY_PATH"
  exit 1
fi
if [[ ! -f "$REPO_DIR/.env" ]]; then
  echo "Local .env not found at: $REPO_DIR/.env"
  exit 1
fi

cd "$REPO_DIR"

TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
TAR_NAME="selfie-app-build-$TIMESTAMP.tar"
TAR_PATH_LOCAL="$REPO_DIR/$TAR_NAME"
TAR_PATH_REMOTE="~/$TAR_NAME"

trap cleanup_local_tar EXIT

# ---------- git add/commit/push ----------
echo "==> [1/6] Git add/commit/push ($MAIN_BRANCH)"
run git add -A

if git diff --cached --quiet; then
  echo "No staged changes to commit/push. Continuing with build."
else
  run git commit -m "$COMMIT_MESSAGE"
  run git push origin "$MAIN_BRANCH"
fi

# ---------- docker build locally ----------
echo "==> [2/6] docker build ($BUILD_TAG)"
if [[ "$NO_CACHE" == "true" ]]; then
  run docker build --progress=plain --no-cache -t "$BUILD_TAG" .
else
  run docker build --progress=plain -t "$BUILD_TAG" .
fi

# ---------- docker save ----------
echo "==> [3/6] docker save -> $TAR_PATH_LOCAL"
run docker save "$BUILD_TAG" -o "$TAR_PATH_LOCAL"

# ---------- optional: copy .env to EC2 ----------
if [[ "$COPY_ENV_TO_EC2" == "true" ]]; then
  echo "==> [3.5/6] scp .env -> EC2 ($REMOTE_ENV_FILE)"
  run scp -i "$SSH_KEY_PATH" "$REPO_DIR/.env" "$SSH_USER@$EC2_HOST:$REMOTE_ENV_FILE"
fi

# ---------- copy tar to EC2 ----------
echo "==> [4/6] scp tar -> EC2 ($SSH_USER@$EC2_HOST:$TAR_PATH_REMOTE)"
run scp -i "$SSH_KEY_PATH" "$TAR_PATH_LOCAL" "$SSH_USER@$EC2_HOST:$TAR_PATH_REMOTE"

# ---------- ssh load + restart ----------
echo "==> [5/6] ssh docker load + restart selfie-app"

ssh -i "$SSH_KEY_PATH" "$SSH_USER@$EC2_HOST" bash -lc "'
  set -euo pipefail
  echo \"Docker load: $TAR_PATH_REMOTE\"
  sudo docker load -i $TAR_PATH_REMOTE

  echo \"Stop/remove existing selfie-app (if any)\"
  sudo docker stop selfie-app 2>/dev/null || true
  sudo docker rm selfie-app 2>/dev/null || true

  echo \"Retag $BUILD_TAG -> $LATEST_TAG (ignore if already tagged)\"
  sudo docker tag $BUILD_TAG $LATEST_TAG 2>/dev/null || true

  echo \"Start selfie-app ($LATEST_TAG) using --env-file $REMOTE_ENV_FILE\"
  sudo docker run -d --name selfie-app -p 3000:3000 --env-file $REMOTE_ENV_FILE --restart unless-stopped $LATEST_TAG

  echo \"Container status:\" 
  sudo docker ps --format \"{{.Names}}  {{.Image}}  {{.Status}}\" | head -n 5
  echo \"Recent logs (last 40 lines):\"
  sudo docker logs --tail 40 selfie-app || true

  # Optional cleanup on EC2: remove tar after load
  # sudo rm -f $TAR_PATH_REMOTE
'" 

echo "==> [6/6] Deploy complete."

