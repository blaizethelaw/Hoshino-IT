# Temporal Local Stack + Sample Workflows (Add‑on Patch)
# 
# This patch adds:
# 1) Temporal Server + Web UI via Docker Compose
# 2) A reusable Workflows package (SLA + Approvals)
# 3) Worker wired to run those workflows
# 4) API endpoint to create an Incident AND start an SLA workflow
#
# Apply the changes below inside your existing `catalyst-itsm` repo.


######################################################################
# 1) docker-compose.yml — add Temporal services
######################################################################

# Append these services to the existing docker-compose.yml
# (keeps your Postgres and Redis as-is)

# --- CUT ---
services:
  temporal-db:
    image: postgres:13
    restart: unless-stopped
    environment:
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: temporal
      POSTGRES_DB: temporal
    ports: ["5433:5432"]

  temporal:
    image: temporalio/auto-setup:1.22
    restart: unless-stopped
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=temporal
      - POSTGRES_SEEDS=temporal-db
      - DYNAMIC_CONFIG_FILE=/etc/temporal/config/dynamicconfig/development.yaml
    ports: ["7233:7233"]
    depends_on: [ temporal-db ]

  temporal-ui:
    image: temporalio/ui:2.26.2
    restart: unless-stopped
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - TEMPORAL_CORS_ORIGINS=http://localhost:3000,http://localhost:3001
    ports: ["8080:8080"]
    depends_on: [ temporal ]
# --- CUT ---


######################################################################
# 2) New package: packages/workflows (pure workflow code)
######################################################################

# Create: packages/workflows/package.json
cat > packages/workflows/package.json <<'EOF'
{
  "name": "@catalyst/workflows",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "license": "MIT",
  "dependencies": {
    "@temporalio/workflow": "^1.9.5"
  }
}
EOF

# Create: packages/workflows/src/index.ts
mkdir -p packages/workflows/src
cat > packages/workflows/src/index.ts <<'EOF'
export * from './slas.workflow';
export * from './approvals.workflow';
EOF

# Create: packages/workflows/src/slas.workflow.ts
cat > packages/workflows/src/slas.workflow.ts <<'EOF'
import { sleep, defineSignal, setHandler, proxyActivities, condition } from '@temporalio/workflow';

export interface SLAParams {
  ticketId: string;
  respondInMs: number;
  resolveInMs: number;
}

const activities = proxyActivities<{
  notifyDueSoon(input: { ticketId: string; target: 'respond' | 'resolve'; dueAt: number }): Promise<void>;
  notifyBreached(input: { ticketId: string; target: 'respond' | 'resolve'; dueAt: number }): Promise<void>;
  setTicketStatus(input: { ticketId: string; status: string }): Promise<void>;
}>({ startToCloseTimeout: '1 minute' });

/** SLA workflow with pause/resume + waiting support via signals */
export async function SLAWorkflow(params: SLAParams) {
  let paused = false;
  let waiting = false;
  let resolved = false;

  const pause = defineSignal('pause');
  const resume = defineSignal('resume');
  const markWaiting = defineSignal('markWaiting');
  const markInProgress = defineSignal('markInProgress');
  const markResolved = defineSignal('markResolved');

  setHandler(pause, () => { paused = true; });
  setHandler(resume, () => { paused = false; });
  setHandler(markWaiting, () => { waiting = true; });
  setHandler(markInProgress, () => { waiting = false; });
  setHandler(markResolved, () => { resolved = true; });

  const start = Date.now();
  await track('respond', start + params.respondInMs, Math.min(5 * 60_000, params.respondInMs / 2));
  await track('resolve', start + params.resolveInMs, Math.min(10 * 60_000, params.resolveInMs / 3));

  async function track(target: 'respond' | 'resolve', dueAt: number, lead: number) {
    const dueSoonAt = dueAt - lead;
    // Due-soon
    while (Date.now() < dueSoonAt) {
      if (paused || waiting) { await condition(() => !paused && !waiting); continue; }
      await sleep(Math.min(5000, dueSoonAt - Date.now()));
    }
    await activities.notifyDueSoon({ ticketId: params.ticketId, target, dueAt });

    // Due
    while (Date.now() < dueAt) {
      if (target === 'resolve' && resolved) return;
      if (paused || waiting) { await condition(() => !paused && !waiting); continue; }
      await sleep(Math.min(5000, dueAt - Date.now()));
    }
    await activities.notifyBreached({ ticketId: params.ticketId, target, dueAt });
  }
}
EOF

# Create: packages/workflows/src/approvals.workflow.ts
cat > packages/workflows/src/approvals.workflow.ts <<'EOF'
import { defineSignal, setHandler, proxyActivities, condition, sleep } from '@temporalio/workflow';

export interface ApprovalParams {
  requestId: string;
  approvers: Array<{ id: string; name: string }>;
  timeoutMs: number;
}

const activities = proxyActivities<{
  notifyApprover(input: { requestId: string; approverId: string }): Promise<void>;
  notifyResult(input: { requestId: string; state: 'approved' | 'rejected' | 'timeout' }): Promise<void>;
}>({ startToCloseTimeout: '1 minute' });

export async function ApprovalWorkflow(params: ApprovalParams) {
  const approved = new Set<string>();
  let rejected = false;

  const approve = defineSignal<[input: { approverId: string; comment?: string }]>('approve');
  const reject = defineSignal<[input: { approverId: string; comment?: string }]>('reject');
  setHandler(approve, (i) => { approved.add(i.approverId); });
  setHandler(reject, (_i) => { rejected = true; });

  // Notify all approvers up-front
  for (const a of params.approvers) await activities.notifyApprover({ requestId: params.requestId, approverId: a.id });

  const allApproved = () => approved.size >= params.approvers.length;

  const done = await Promise.race([
    condition(() => rejected || allApproved(), Infinity).then(() => true),
    sleep(params.timeoutMs).then(() => false),
  ]);

  if (!done) return activities.notifyResult({ requestId: params.requestId, state: 'timeout' });
  if (rejected) return activities.notifyResult({ requestId: params.requestId, state: 'rejected' });
  return activities.notifyResult({ requestId: params.requestId, state: 'approved' });
}
EOF


######################################################################
# 3) Worker – register workflows + activities
######################################################################

# Update: apps/worker/package.json (add nothing if already present, else ensure deps)
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
    "typescript": "^5.5.4"
  }
}
EOF

# Create: apps/worker/src/activities.ts
cat > apps/worker/src/activities.ts <<'EOF'
export async function notifyDueSoon(input: { ticketId: string; target: 'respond' | 'resolve'; dueAt: number }) {
  console.log(`[SLA] Due soon (${input.target}) for ticket ${input.ticketId} at ${new Date(input.dueAt).toISOString()}`);
}
export async function notifyBreached(input: { ticketId: string; target: 'respond' | 'resolve'; dueAt: number }) {
  console.warn(`[SLA] BREACHED (${input.target}) for ticket ${input.ticketId} at ${new Date(input.dueAt).toISOString()}`);
}
export async function setTicketStatus(input: { ticketId: string; status: string }) {
  console.log(`[Ticket] Set status ${input.status} for ${input.ticketId}`);
}

export async function notifyApprover(input: { requestId: string; approverId: string }) {
  console.log(`[Approval] Notify approver ${input.approverId} for request ${input.requestId}`);
}
export async function notifyResult(input: { requestId: string; state: 'approved' | 'rejected' | 'timeout' }) {
  console.log(`[Approval] Final state for ${input.requestId}: ${input.state}`);
}
EOF

# Update: apps/worker/src/index.ts (ESM-safe workflowsPath)
cat > apps/worker/src/index.ts <<'EOF'
import { Worker } from '@temporalio/worker';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import * as activities from './activities';

async function run() {
  const here = dirname(fileURLToPath(import.meta.url));
  const workflowsPath = resolve(here, '../../packages/workflows/src/index.ts');
  const worker = await Worker.create({
    workflowsPath,
    activities,
    taskQueue: 'catalyst',
  });
  console.log('Temporal worker started on task queue "catalyst"');
  await worker.run();
}

run().catch((err) => { console.error(err); process.exit(1); });
EOF

# Update: apps/worker/.env.example
cat > apps/worker/.env.example <<'EOF'
TEMPORAL_ADDRESS=localhost:7233
EOF


######################################################################
# 4) API – add incident create + kick off SLA workflow
######################################################################

# Update: apps/api/package.json (add Temporal client)
cat > apps/api/package.json <<'EOF'
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
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-fastify": "^10.0.0",
    "@prisma/client": "^5.18.0",
    "@temporalio/client": "^1.9.5",
    "argon2": "^0.40.2",
    "fastify": "^4.28.1",
    "fastify-cors": "^8.5.0",
    "fastify-helmet": "^12.3.0",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.6",
    "prisma": "^5.18.0",
    "ts-node": "^10.9.2",
    "tsx": "^4.16.2",
    "typescript": "^5.5.4"
  }
}
EOF

# Create: apps/api/src/modules/tickets/incidents.controller.ts
mkdir -p apps/api/src/modules/tickets
cat > apps/api/src/modules/tickets/incidents.controller.ts <<'EOF'
import { Body, Controller, Post } from '@nestjs/common';
import { TicketsService } from './tickets.service';

@Controller('portal/incidents')
export class IncidentsController {
  constructor(private svc: TicketsService) {}

  @Post()
  async create(@Body() body: any) {
    return this.svc.createIncident(body);
  }
}
EOF

# Update: apps/api/src/modules/tickets/tickets.module.ts (register new controller)
cat > apps/api/src/modules/tickets/tickets.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { IncidentsController } from './incidents.controller';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../common/prisma.service';

@Module({ controllers: [TicketsController, IncidentsController], providers: [TicketsService, PrismaService] })
export class TicketsModule {}
EOF

# Update: apps/api/src/modules/tickets/tickets.service.ts
cat > apps/api/src/modules/tickets/tickets.service.ts <<'EOF'
import { Injectable } from '@nestjs/common';
import { PrismaClient, TicketKind, TicketPriority } from '@prisma/client';
import { Connection, Client } from '@temporalio/client';
import { SLAWorkflow } from '@catalyst/workflows';

@Injectable()
export class TicketsService {
  prisma = new PrismaClient();

  async list(_q: any) {
    const items = await this.prisma.ticket.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
    return { items };
  }

  async createIncident(input: any) {
    const nextNumber = await this.nextNumber('INC');
    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId: input.tenantId ?? '00000000-0000-0000-0000-000000000000',
        kind: TicketKind.incident,
        number: nextNumber,
        subject: input.subject ?? 'Untitled Incident',
        description: input.description ?? '',
        requesterId: input.requesterId ?? '00000000-0000-0000-0000-000000000000',
        priority: (input.priority as TicketPriority) ?? TicketPriority.P3,
      },
    });

    // Map priority → SLA (demo values)
    const p = ticket.priority;
    const respondInMs = p === 'P1' ? 15 * 60_000 : p === 'P2' ? 30 * 60_000 : 4 * 60_000; // quick for demo
    const resolveInMs = p === 'P1' ? 4 * 60 * 60_000 : p === 'P2' ? 8 * 60 * 60_000 : 12 * 60_000; // quick for demo

    // Kick off SLA workflow
    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    const connection = await Connection.connect({ address });
    const client = new Client({ connection });
    await client.workflow.start(SLAWorkflow, {
      taskQueue: 'catalyst',
      workflowId: `sla-${ticket.id}`,
      args: [{ ticketId: ticket.id, respondInMs, resolveInMs }],
    });

    return ticket;
  }

  private async nextNumber(prefix: string) {
    const count = await this.prisma.ticket.count();
    return `${prefix}-${String(count + 1).padStart(6, '0')}`;
  }
}
EOF

# Update: apps/api/.env.example
cat > apps/api/.env.example <<'EOF'
DATABASE_URL=postgresql://catalyst:catalyst@localhost:5432/catalyst
SHADOW_DATABASE_URL=postgresql://catalyst:catalyst@localhost:5432/catalyst
PORT=4000
TEMPORAL_ADDRESS=localhost:7233
EOF


######################################################################
# 5) Usage / Smoke Test
######################################################################

: <<'USAGE'
# Start local stack (add Temporal)
# In repo root:
  docker compose up -d

# Prepare API
  cd apps/api
  cp .env.example .env
  pnpm prisma:generate
  pnpm prisma:migrate
  pnpm seed
  cd ../../

# Install deps and start everything
  pnpm install
  pnpm -r dev
  # portal: http://localhost:3000
  # agent:  http://localhost:3001
  # api:    http://localhost:4000/v1
  # temporal ui: http://localhost:8080

# Create a demo incident (starts SLA workflow)
  curl -X POST http://localhost:4000/v1/portal/incidents \
    -H 'content-type: application/json' \
    -d '{"subject":"VPN down","description":"Cannot connect","priority":"P2"}'

# Watch worker logs for dueSoon/breach, and browse Temporal UI → workflows
USAGE


######################################################################
# 6) Notes
######################################################################
# • Workflows live in a pure package (@catalyst/workflows) so both API (client) and worker can import them.
# • Activities here just log; wire them to email/Teams/DB updates later.
# • Signals exposed by SLAWorkflow: pause, resume, markWaiting, markInProgress, markResolved.
#   You can send signals from API using client.workflow.getHandle('sla-<ticketId>').signal('pause').
# • ApprovalWorkflow supports approve/reject signals and a timeout path.
