#!/bin/bash
set -e

# Update and install Docker
yum update -y || dnf update -y || true
amazon-linux-extras install docker -y 2>/dev/null || dnf install -y docker || yum install -y docker
systemctl enable docker
systemctl start docker

# Pull and run DocuSeal container
if ! docker ps --format '{{.Names}}' | grep -q '^docuseal$'; then
  docker pull docuseal/docuseal:latest
  docker run -d --name docuseal \
    -p 80:3000 \
    docuseal/docuseal:latest
fi
