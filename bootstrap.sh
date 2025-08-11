#!/usr/bin/env bash
set -euo pipefail

# === Config ===
PROJECT_NAME="catalyst-itsm"
DEFAULT_BRANCH="main"

echo "==> Creating Catalyst ITSM monorepo scaffold in $PROJECT_NAME"

# Make project folder
mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

# Init git if allowed
if [ "${GIT_INIT:-1}" -eq 1 ]; then
  git init
  git checkout -b "$DEFAULT_BRANCH"
fi

# Workspace setup
cat <<EOF > pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
EOF

# Package.json
cat <<EOF > package.json
{
  "name": "$PROJECT_NAME",
  "private": true,
  "packageManager": "pnpm@9",
  "scripts": {
    "dev": "pnpm -r dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  }
}
EOF

# Create app folders
mkdir -p apps/api apps/portal apps/agent

# Create package folders
mkdir -p packages/ui packages/utils packages/types packages/sdk

# Docker Compose
cat <<EOF > docker-compose.yml
version: "3.8"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: catalyst
      POSTGRES_PASSWORD: catalyst
      POSTGRES_DB: catalyst
    ports:
      - "5432:5432"
  redis:
    image: redis:7
    ports:
      - "6379:6379"
EOF

# README
cat <<EOF > README.md
# $PROJECT_NAME
Catalyst ITSM monorepo scaffold.
EOF

echo "==> Scaffold complete."
