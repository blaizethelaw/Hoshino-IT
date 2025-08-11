#!/usr/bin/env bash
set -euo pipefail

printf "\n🚀 Bootstrap: creating minimal monorepo skeleton...\n\n"

ROOT="catalyst-itsm"
mkdir -p "$ROOT/apps/portal"

cat > "$ROOT/package.json" <<'JSON'
{
  "name": "catalyst-itsm",
  "private": true,
  "packageManager": "pnpm@9",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "echo no-build",
    "lint": "echo no-lint"
  }
}
JSON

cat > "$ROOT/pnpm-workspace.yaml" <<'YAML'
packages:
  - "apps/*"
YAML

cat > "$ROOT/apps/portal/package.json" <<'JSON'
{
  "name": "@catalyst/apps-portal",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node server.js"
  },
  "dependencies": {}
}
JSON

cat > "$ROOT/apps/portal/server.js" <<'JS'
import http from 'node:http';
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Portal dev server is up ✅\n');
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
JS

printf "\n✅ Bootstrap done. Next: \n  cd catalyst-itsm && pnpm install && pnpm -r dev\n\n"
