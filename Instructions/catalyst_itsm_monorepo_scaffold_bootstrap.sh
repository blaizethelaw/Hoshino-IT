#!/usr/bin/env bash
# Catalyst ITSM Monorepo Scaffold
# -------------------------------------------------------------
# This script bootstraps a full-stack monorepo matching the
# "Catalyst ITSM – Full Build Guide (Developer Hand‑Off)" spec.
#
# What you get
# - pnpm + Turborepo monorepo
# - Apps: portal (Next.js), agent (Next.js), api (NestJS), worker (Temporal)
# - Packages: ui (design system), sdk (generated client placeholder), types, utils
# - Prisma schema w/ RLS-friendly models, seed stub
# - GitHub Actions CI, ESLint/Prettier, Tailwind, PostCSS
# - Docker Compose for local Postgres + Redis
#
# Usage
#   bash bootstrap.sh
#   cd catalyst-itsm
#   pnpm install
#   pnpm -r dev
#
# Requirements: Node 22+, pnpm 9+, git, bash
set -euo pipefail

REPO=catalyst-itsm
PKG_VITE="^5.4.0"
PKG_NEXT="^15.0.0"
PKG_REACT="^19.0.0"
PKG_TAILWIND="^3.4.7"
PKG_NEST="^10.0.0"
PKG_PRISMA="^5.18.0"
PKG_TYPESCRIPT="^5.5.4"
PKG_JEST="^29.7.0"
PKG_PLAYWRIGHT="^1.46.0"
PKG_TEMPORAL="^1.9.5"

mkdir -p "$REPO" && cd "$REPO"

git init >/dev/null 2>&1 || true

echo "v22.3.0" > .nvmrc

# ---------------- Root files -----------------
cat > .gitignore <<'EOF'
# Dependencies
node_modules
.pnp.*
# Build
.next
out
dist
coverage
.turbo
# Env
.env
.env.*.local
# OS/IDE
.DS_Store
*.log
.vscode/
EOF

cat > .editorconfig <<'EOF'
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
EOF

cat > pnpm-workspace.yaml <<'EOF'
packages:
  - apps/*
  - packages/*
EOF

cat > package.json <<'EOF'
{
  "name": "@catalyst/root",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "format": "prettier --write .",
    "typecheck": "turbo typecheck",
    "postinstall": "husky install || true"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "eslint": "^9.8.0",
    "husky": "^9.0.11",
    "prettier": "^3.3.3",
    "turbo": "^2.0.6",
    "typescript": "^5.5.4"
  }
}
EOF

cat > turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", "build/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "outputs": [] },
    "test": { "outputs": ["coverage/**"] },
    "typecheck": { "outputs": [] }
  }
}
EOF

cat > tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "@catalyst/ui/*": ["packages/ui/src/*"],
      "@catalyst/utils/*": ["packages/utils/src/*"],
      "@catalyst/types": ["packages/types/src/index.ts"],
      "@catalyst/sdk": ["packages/sdk/src/index.ts"]
    }
  }
}
EOF

cat > prettier.config.cjs <<'EOF'
module.exports = {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  semi: true
};
EOF

cat > .eslintrc.cjs <<'EOF'
module.exports = {
  root: true,
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  env: { es2022: true, node: true, browser: true },
  extends: ['eslint:recommended'],
  rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] }
};
EOF

mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: ci
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm -r build
EOF

cat > README.md <<'EOF'
# Catalyst ITSM Monorepo

This repository implements the Catalyst ITSM platform per the hand-off guide.

## Quickstart
```bash
pnpm install
pnpm -r dev
```

## Apps
- `apps/portal` – End-user portal (Next.js)
- `apps/agent` – Agent/Admin app (Next.js)
- `apps/api` – Backend API (NestJS + Prisma + Fastify)
- `apps/worker` – Temporal worker for SLAs/approvals/playbooks

## Dev services
- `docker compose up -d` for Postgres + Redis.
- Copy `.env.example` → `.env` in each app and adjust.
EOF

# ---------------- Dev services -----------------
cat > docker-compose.yml <<'EOF'
version: '3.9'
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: catalyst
      POSTGRES_PASSWORD: catalyst
      POSTGRES_DB: catalyst
    ports: ["5432:5432"]
    volumes:
      - db_data:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports: ["6379:6379"]
volumes:
  db_data:
EOF

# ---------------- Packages -----------------
mkdir -p packages/ui/src/components packages/utils/src packages/types/src packages/sdk/src

cat > packages/ui/package.json <<'EOF'
{
  "name": "@catalyst/ui",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "license": "MIT",
  "dependencies": {
    "clsx": "^2.1.0",
    "framer-motion": "^11.3.31",
    "lucide-react": "^0.452.0",
    "recharts": "^2.12.0"
  }
}
EOF

cat > packages/ui/src/index.ts <<'EOF'
export * from './components/Button';
export * from './components/Card';
export * from './components/StatusPill';
EOF

cat > packages/ui/src/components/Button.tsx <<'EOF'
import { forwardRef } from 'react';
import { cn } from '@catalyst/utils/cn';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium shadow-sm transition',
        variant === 'primary' && 'bg-black text-white hover:opacity-90',
        variant === 'secondary' && 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900',
        variant === 'ghost' && 'hover:bg-zinc-100',
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
EOF

cat > packages/ui/src/components/Card.tsx <<'EOF'
import { cn } from '@catalyst/utils/cn';
import { PropsWithChildren } from 'react';

export function Card({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('rounded-2xl border p-4 shadow-sm', className)}>{children}</div>;
}
EOF

cat > packages/ui/src/components/StatusPill.tsx <<'EOF'
export function StatusPill({ status }: { status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed' }) {
  const map: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-amber-100 text-amber-800',
    waiting: 'bg-zinc-100 text-zinc-800',
    resolved: 'bg-emerald-100 text-emerald-800',
    closed: 'bg-zinc-200 text-zinc-700'
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${map[status]}`}>{status.replace('_', ' ')}</span>;
}
EOF

cat > packages/utils/package.json <<'EOF'
{
  "name": "@catalyst/utils",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "license": "MIT"
}
EOF

cat > packages/utils/src/index.ts <<'EOF'
export * from './cn';
export * from './time';
EOF

cat > packages/utils/src/cn.ts <<'EOF'
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
EOF

cat > packages/utils/src/time.ts <<'EOF'
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString();
}
EOF

cat > packages/types/package.json <<'EOF'
{
  "name": "@catalyst/types",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "license": "MIT"
}
EOF

cat > packages/types/src/index.ts <<'EOF'
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export interface Ticket {
  id: string;
  number: string;
  subject: string;
  status: TicketStatus;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  createdAt: string;
}
EOF

cat > packages/sdk/package.json <<'EOF'
{
  "name": "@catalyst/sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "license": "MIT",
  "dependencies": {
    "ky": "^1.2.4"
  }
}
EOF

cat > packages/sdk/src/index.ts <<'EOF'
import ky from 'ky';

export function createClient(baseUrl: string, token?: string) {
  const http = ky.create({
    prefixUrl: baseUrl,
    hooks: {
      beforeRequest: [async (req) => token && req.headers.set('Authorization', `Bearer ${token}`)]
    }
  });
  return {
    tickets: {
      list: (params: Record<string, string | number | boolean> = {}) => http.get('v1/portal/tickets', { searchParams: params }).json(),
      createIncident: (body: unknown) => http.post('v1/portal/incidents', { json: body }).json()
    }
  };
}
EOF

# ---------------- Apps: Next.js (portal & agent) -----------------
for APP in portal agent; do
  mkdir -p "apps/$APP/public" "apps/$APP/app" "apps/$APP/styles"

  cat > "apps/$APP/package.json" <<EOF
{
  "name": "@catalyst/$APP",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p ${APP == portal ? 3000 : 3001}",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@catalyst/sdk": "workspace:*",
    "@catalyst/types": "workspace:*",
    "@catalyst/ui": "workspace:*",
    "@catalyst/utils": "workspace:*",
    "next": "$PKG_NEXT",
    "react": "$PKG_REACT",
    "react-dom": "$PKG_REACT",
    "framer-motion": "^11.3.31"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "$PKG_TAILWIND",
    "typescript": "$PKG_TYPESCRIPT"
  }
}
EOF

  cat > "apps/$APP/tsconfig.json" <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
EOF

  cat > "apps/$APP/next.config.mjs" <<'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = { experimental: { reactCompiler: true } };
export default nextConfig;
EOF

  cat > "apps/$APP/postcss.config.mjs" <<'EOF'
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
EOF

  cat > "apps/$APP/tailwind.config.ts" <<'EOF'
import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { borderRadius: { '2xl': '1rem' } } },
  plugins: []
} satisfies Config;
EOF

  cat > "apps/$APP/app/globals.css" <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
:root { color-scheme: light; }
EOF

  cat > "apps/$APP/app/layout.tsx" <<'EOF'
import './globals.css';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-zinc-900 antialiased">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </body>
    </html>
  );
}
EOF

  if [ "$APP" = "portal" ]; then
    cat > "apps/$APP/app/page.tsx" <<'EOF'
'use client';
import { useState, useEffect } from 'react';
import { Button, Card, StatusPill } from '@catalyst/ui';
import { createClient } from '@catalyst/sdk';

const api = createClient(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/');

export default function Page() {
  const [tickets, setTickets] = useState<any[]>([]);
  useEffect(() => {
    api.tickets.list({ mine: true, status: 'open' }).then((d: any) => setTickets(d.items ?? d));
  }, []);
  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Portal</h1>
        <Button onClick={() => alert('New Incident flow TBD')}>New Incident</Button>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {tickets.map((t) => (
          <Card key={t.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{t.number} · {t.subject}</div>
                <div className="text-sm text-zinc-500">P: {t.priority} · {new Date(t.createdAt).toLocaleString()}</div>
              </div>
              <StatusPill status={t.status} />
            </div>
          </Card>
        ))}
      </section>
    </main>
  );
}
EOF
  else
    cat > "apps/$APP/app/page.tsx" <<'EOF'
'use client';
import { Card } from '@catalyst/ui';

export default function Page() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Agent Cockpit</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>Queue: Default · Open tickets: 0</Card>
        <Card>SLA breaches: 0</Card>
      </div>
    </main>
  );
}
EOF
  fi

  cat > "apps/$APP/.env.example" <<'EOF'
NEXT_PUBLIC_API_URL=http://localhost:4000/
EOF

done

# ---------------- App: API (NestJS) -----------------
mkdir -p apps/api/src/modules/tickets apps/api/prisma

cat > apps/api/package.json <<EOF
{
  "name": "@catalyst/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "seed": "tsx src/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "$PKG_NEST",
    "@nestjs/core": "$PKG_NEST",
    "@nestjs/platform-fastify": "$PKG_NEST",
    "@prisma/client": "$PKG_PRISMA",
    "argon2": "^0.40.2",
    "fastify": "^4.28.1",
    "fastify-cors": "^8.5.0",
    "fastify-helmet": "^12.3.0",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.6",
    "prisma": "$PKG_PRISMA",
    "ts-node": "^10.9.2",
    "tsx": "^4.16.2",
    "typescript": "$PKG_TYPESCRIPT"
  }
}
EOF

cat > apps/api/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "moduleResolution": "Node",
    "module": "ESNext",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  },
  "include": ["src/**/*"]
}
EOF

cat > apps/api/src/main.ts <<'EOF'
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from 'fastify-helmet';
import cors from 'fastify-cors';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(cors, { origin: true, credentials: true });
  await app.register(helmet);

  app.setGlobalPrefix('v1');
  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on http://localhost:${port}`);
}
bootstrap();
EOF

mkdir -p apps/api/src/modules/common
cat > apps/api/src/modules/app.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { TicketsModule } from './tickets/tickets.module';

@Module({ imports: [TicketsModule] })
export class AppModule {}
EOF

cat > apps/api/src/modules/tickets/tickets.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../common/prisma.service';

@Module({ controllers: [TicketsController], providers: [TicketsService, PrismaService] })
export class TicketsModule {}
EOF

cat > apps/api/src/modules/common/prisma.service.ts <<'EOF'
import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => { await app.close(); });
  }
}
EOF

cat > apps/api/src/modules/tickets/tickets.controller.ts <<'EOF'
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { TicketsService } from './tickets.service';

@Controller('portal/tickets')
export class TicketsController {
  constructor(private svc: TicketsService) {}

  @Get()
  async list(@Query() q: any) {
    return this.svc.list(q);
  }
}
EOF

cat > apps/api/src/modules/tickets/tickets.service.ts <<'EOF'
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TicketsService {
  prisma = new PrismaClient();

  async list(_q: any) {
    const items = await this.prisma.ticket.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
    return { items };
  }
}
EOF

cat > apps/api/prisma/schema.prisma <<'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TicketKind { incident request }
enum TicketPriority { P1 P2 P3 P4 }
enum TicketStatus { open in_progress waiting resolved closed }

datasource shadow {
  provider = "postgresql"
  url      = env("SHADOW_DATABASE_URL")
}

model Tenant {
  id        String  @id @default(uuid())
  name      String
  slug      String  @unique
  createdAt DateTime @default(now())
  users     TenantMember[]
}

model User {
  id           String  @id @default(uuid())
  primaryEmail String  @unique
  displayName  String
  createdAt    DateTime @default(now())
  memberships  TenantMember[]
}

model TenantMember {
  userId   String
  tenantId String
  roles    String[]
  user     User   @relation(fields: [userId], references: [id])
  tenant   Tenant @relation(fields: [tenantId], references: [id])
  @@id([userId, tenantId])
}

model Ticket {
  id          String         @id @default(uuid())
  tenantId    String
  kind        TicketKind
  number      String         @unique
  subject     String
  description String
  requesterId String
  assigneeId  String?
  priority    TicketPriority @default(P3)
  status      TicketStatus   @default(open)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  @@index([tenantId, status, priority])
}
EOF

cat > apps/api/src/seed.ts <<'EOF'
import { PrismaClient, TicketKind } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: { slug: 'acme', name: 'Acme Corp' }
  });
  const user = await prisma.user.upsert({
    where: { primaryEmail: 'alex@acme.com' },
    update: {},
    create: { primaryEmail: 'alex@acme.com', displayName: 'Alex Employee' }
  });
  await prisma.tenantMember.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: { roles: ['end_user'] },
    create: { userId: user.id, tenantId: tenant.id, roles: ['end_user'] }
  });
  for (let i = 1; i <= 5; i++) {
    await prisma.ticket.upsert({
      where: { number: `INC-${String(i).padStart(6, '0')}` },
      update: {},
      create: {
        tenantId: tenant.id,
        kind: TicketKind.incident,
        number: `INC-${String(i).padStart(6, '0')}`,
        subject: `Sample ticket #${i}`,
        description: 'Demo incident',
        requesterId: user.id
      }
    });
  }
  console.log('Seeded ✅');
  process.exit(0);
})();
EOF

cat > apps/api/.env.example <<'EOF'
DATABASE_URL=postgresql://catalyst:catalyst@localhost:5432/catalyst
SHADOW_DATABASE_URL=postgresql://catalyst:catalyst@localhost:5432/catalyst
PORT=4000
EOF

# ---------------- App: Temporal Worker -----------------
mkdir -p apps/worker/src
cat > apps/worker/package.json <<'EOF'
{
  "name": "@catalyst/worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@temporalio/worker": "^1.9.5"
  },
  "devDependencies": {
    "tsx": "^4.16.2",
    "typescript": "$PKG_TYPESCRIPT"
  }
}
EOF

cat > apps/worker/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src/**/*"]
}
EOF

cat > apps/worker/src/index.ts <<'EOF'
import { Worker } from '@temporalio/worker';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    taskQueue: 'catalyst',
  });
  await worker.run();
}
run().catch((err) => { console.error(err); process.exit(1); });
EOF

cat > apps/worker/src/workflows.ts <<'EOF'
// Placeholder workflows. Define incident/request SLAs, approvals, playbooks here.
export async function echo(input: string) { return `echo:${input}`; }
EOF

# ---------------- Root Husky hook -----------------
mkdir -p .husky
cat > .husky/pre-commit <<'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm lint -w @catalyst/root || true
EOF
chmod +x .husky/pre-commit || true

# ---------------- Fin -----------------
echo "\nScaffold complete ✅"
echo "Next steps:"
echo "1) docker compose up -d"
echo "2) cd apps/api && cp .env.example .env && pnpm prisma:generate && pnpm prisma:migrate && pnpm seed"
echo "3) In repo root: pnpm install"
echo "4) pnpm -r dev (portal:3000, agent:3001, api:4000)"
