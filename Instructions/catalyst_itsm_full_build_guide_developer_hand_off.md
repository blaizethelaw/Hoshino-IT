# Catalyst ITSM – Full Build Guide (Developer Hand‑Off)

> A complete, implementation‑ready blueprint to build a fully functional, multi‑tenant IT Service Management platform (incidents **and** service requests) from scratch. This handoff includes architecture, data model, API contracts, frontend spec, workflow logic, integrations, security, observability, CI/CD, test strategy, deployment runbooks, performance budgets, acceptance criteria, and example code/configs. It is written so a capable team can build and launch with minimal back‑and‑forth.

---

## 0) TL;DR for Engineering Leads

- **Primary stack (Production SaaS)**: **React 19 + Next.js 15** (App Router), **TypeScript**, **Tailwind + shadcn/ui**, **React Hook Form + Zod**, **TanStack Query**, **NestJS (Node 22) + Fastify**, **OpenAPI 3.1**, **PostgreSQL 16** (RLS multi‑tenant), **Prisma ORM**, **Redis** (cache + rate limit + pub/sub), **Azure Service Bus** (events/queues), **Temporal** (workflows), **Azure Blob Storage** (attachments), **Azure Cognitive Search** (tickets + KB), **Azure Entra ID (OIDC)**, **Azure Monitor + App Insights + OpenTelemetry**, **Playwright** (E2E), **Vitest** (unit), **k6** (perf), **GitHub Actions** (CI/CD), **Turborepo + pnpm** (monorepo), **ESLint/Prettier/Husky**.
- **MVP fast‑track**: React frontend + **Firebase** (auth/DB/storage/security rules) + **Cloud Functions**; **Vercel/Netlify** (hosting). Migration plan to Production SaaS included.
- **Core principle**: *Hard split* between **Incidents** ("something broke") and **Service Requests** ("I need something"). Separate forms, workflows, SLAs, routing, analytics.
- **Tenancy**: single DB, **Row‑Level Security** by `tenant_id`, enforced in DB **and** service layer. Optional schema‑per‑tenant for large customers.
- **Security**: OIDC SSO, short‑lived JWTs with tenant scopes, RBAC + ABAC, field‑level audit, secrets in Key Vault, CIS baselines.
- **Non‑functional targets**: p95 API < **200ms**, 99.9% uptime, search freshness < **5m**, workflow success > **99%**, MTTR < **30m** for P1, RPO **< 15m**, RTO **< 1h**.

---

## 1) Product Scope & Outcomes

### 1.1 Personas & Journeys
- **End‑User (Employee)**: Submit incidents/requests; browse Knowledge Base; view status; comment; respond to approvals; receive notifications; escalate if SLA risks.
- **IT Agent**: Triage queue; auto‑assignment; bulk actions; quick replies; resolve; link/merge; manage SLAs; collaborate via internal notes; trigger playbooks.
- **Tenant Admin**: Configure catalog, SLAs, business hours/holidays, queues, routing rules, approvals, email domains, branding, roles/permissions, webhooks, integrations.
- **Exec/Stakeholder**: Dashboards, exports, SLA compliance, deflection rate, agent utilization, trends.

### 1.2 Success Metrics
- **FCR↑** (First‑Contact Resolution), **TTR↓** (Time to Restore), **Deflection↑** (self‑service), **SLA compliance↑**, **Agent utilization↑**, **CSAT↑**, **Backlog↓**, **Breaches↓**, **MTTA/MTTR↓**.

### 1.3 Out‑of‑Scope (MVP)
- Full ITIL Change/Problem modules (provide *lightweight* problem candidates). Advanced CMDB (only lightweight assets). Native mobile apps (PWA only).

---

## 2) Architecture

### 2.1 System Overview
- **Client**: Next.js 15 with SSR/ISR for KB & public pages; Client components for app surfaces; PWA optional; i18n via next‑intl.
- **API**: NestJS modular monolith initially: `core`, `authn`, `authz`, `tenancy`, `tickets`, `requests`, `kb`, `catalog`, `assets`, `workflow`, `integrations`, `search`, `notifications`, `reporting`.
- **Data**: Postgres 16 + Prisma; Redis for cache/pubsub/rate limit; Blob for uploads; Service Bus for domain events; Temporal for orchestrations; Cognitive Search for retrieval; App Insights + OTEL for telemetry.
- **Bounded Contexts**: Support, Catalog, Knowledge, Identity/Org, Assets, Workflow, Notifications, Integrations.

### 2.2 Deployment Topologies
- **Phase 1 (PaaS)**: App Service (API + SSR), Azure DB for PostgreSQL, Azure Cache for Redis, Blob Storage, Service Bus, Cognitive Search, App Insights, Key Vault, Front Door (WAF), Private DNS/Links.
- **Phase 2 (AKS)**: Break out `workflow` & `integrations` microservices; HPA; KEDA (event scaling); Dapr sidecars optional; multi‑AZ; blue/green.
- **Phase 3 (Multi‑Region)**: Active/Passive with Front Door; read replicas; cross‑region blob replication; ASB geo‑disaster recovery.

### 2.3 Data Flow (happy path)
1. User authenticates via Entra (OIDC). Token contains tenant claims and roles.
2. Frontend uses SDK (OpenAPI‑generated) with TanStack Query for data.
3. API sets `app.tenant_id` on connection, enforcing RLS.
4. Writes emit domain events to Service Bus; indexers update Cognitive Search; Temporal starts/continues workflows (SLA timers, approvals, playbooks).
5. Notifications fan out via email/Teams/Slack and in‑app toasts.

### 2.4 Availability & Scaling
- Stateless API pods; Redis for distributed locks and rate limits; DB with read replica; queue workers auto‑scale; shard indexers by tenant if needed.

---

## 3) Data Model (Relational)

### 3.1 Tenancy & Identity
- `tenants(id, name, slug, plan, status, settings jsonb, created_at)`
- `tenant_members(user_id, tenant_id, roles[], attributes jsonb, invited_by, invited_at)`
- `users(id, primary_email, display_name, avatar_url, locale, time_zone, is_active)`
- `identities(id, user_id, provider, provider_sub, last_login_at)`
- `departments(id, tenant_id, name)`

### 3.2 Catalog & KB
- `service_categories(id, tenant_id, name, icon, sort)`
- `service_items(id, tenant_id, category_id, name, description, approval_required, form_schema jsonb, fulfillment_playbook jsonb, visibility enum[all,agents,link_only], tags[], owner_queue_id)`
- `kb_articles(id, tenant_id, title, content_md, tags[], visibility enum[public,tenant,agents], owner_id, status enum[draft,review,published,archived], updated_at, search_vector tsvector)`
- `kb_revisions(id, article_id, author_id, content_md, created_at)`

### 3.3 Assets (lightweight CMDB)
- `assets(id, tenant_id, type, model, serial, owner_user_id, status enum[in_use,spare,retired], location, purchase_date, meta jsonb)`

### 3.4 Tickets & Related
- `tickets(id, tenant_id, kind enum[incident,request], number, subject, description, requester_id, assignee_id, queue_id, priority enum[P1,P2,P3,P4], status enum[open,in_progress,waiting,resolved,closed], category_id, service_item_id, asset_id, channel enum[portal,email,api,chat], created_at, updated_at, closed_at, meta jsonb)`
- `ticket_comments(id, tenant_id, ticket_id, author_id, body_md, is_private, created_at)`
- `ticket_attachments(id, tenant_id, ticket_id, blob_url, filename, size, content_type, uploaded_by, created_at)`
- `ticket_links(id, tenant_id, source_ticket_id, target_ticket_id, relation enum[duplicate,blocked_by,relates_to,caused_by])`
- `ticket_tags(ticket_id, tag)` or normalized `tags` table.
- `tasks(id, tenant_id, ticket_id, title, description, assignee_id, status enum[pending,doing,done,cancelled], due_at, meta jsonb)`

### 3.5 SLA/Workflow & Approvals
- `sla_policies(id, tenant_id, name, applies_to enum[kind,queue,priority], business_hours_id, targets jsonb)`
- `business_hours(id, tenant_id, tz, hours jsonb, holidays jsonb)`
- `ticket_sla_tracks(id, tenant_id, ticket_id, policy_id, started_at, due_at, paused_until, breached_at, status enum[active,paused,breached,met])`
- `approvals(id, tenant_id, request_id, approver_id, state enum[pending,approved,rejected], decided_at, comment)`

### 3.6 Integrations, Notifications & Audit
- `webhooks(id, tenant_id, url, secret, events[], active)`
- `integration_connections(id, tenant_id, provider, credentials_secret_ref, scopes[])`
- `notifications(id, tenant_id, user_id, channel enum[email,teams,slack,in_app], template_id, payload jsonb, state enum[pending,sent,failed], sent_at)`
- `audit_logs(id, tenant_id, actor_id, entity, entity_id, action, before jsonb, after jsonb, ip, ua, at)`

> **Indexes**: composite `(tenant_id, status, priority)`, GIN on `meta`, full‑text `tsvector` for tickets and KB; partial indexes for open tickets.

### 3.7 Multi‑Tenant Enforcement
Every table includes `tenant_id`. **RLS policy** per table: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`. Set `SET LOCAL app.tenant_id = $1` per request.

### 3.8 Data Retention
- Tickets & comments: retain **7 years** (configurable). Attachments: **3 years** default. Audit logs: **2 years**. Soft‑delete + purge jobs.

---

## 4) API Contracts (OpenAPI 3.1)

### 4.1 Standards
- RESTful, resource‑oriented. JSON in UTF‑8. Dates in ISO‑8601 UTC. **Idempotency‑Key** for POSTs creating resources. ETags + `If‑Match` for updates. Pagination: `page` + `pageSize` or cursor. Sorting via `sort=field:asc|desc`. Filtering via Rison or query params.
- Errors: **Problem+JSON** `{ type, title, status, detail, instance, errors[] }`. Error codes start `CAT_` (e.g., `CAT_VALIDATION`, `CAT_TENANT_FORBIDDEN`).

### 4.2 Auth
- OIDC code flow → API mints short‑lived tenant‑scoped JWT (`sub`, `tenant`, `roles`, `attrs`, `exp`). Scopes: `tickets:read`, `tickets:write`, `tickets:assign`, `requests:approve`, `kb:edit`, `catalog:admin`, etc.

### 4.3 Endpoints (representative)
- `POST /v1/portal/incidents` → Create incident.
- `POST /v1/portal/requests` → Create service request from catalog item.
- `GET /v1/portal/tickets?mine=true&status=open&sort=createdAt:desc&page=1&pageSize=25` → Paginated list.
- `GET /v1/catalog` → Categories + items.
- `GET /v1/kb/search?q=...&tags=...` → Search (tickets + KB via aggregator service).
- `POST /v1/tickets/{id}/comments` → Add comment (`isPrivate` allowed by role).
- `POST /v1/tickets/{id}/attachments` → Pre‑signed upload; virus scan async.
- `POST /v1/agent/triage/assign` → Bulk assignment (payload: ticket IDs + rule).
- `POST /v1/agent/requests/{id}/approve|reject` → Approval actions.
- `POST /v1/webhooks/test` → Fire sample event to configured URL.
- `GET /v1/reports/summary?from=...&to=...` → KPI aggregates.

### 4.4 Common Types (extracts)
```json
// Ticket (response)
{
  "id": "uuid",
  "kind": "incident",
  "number": "INC-000045",
  "subject": "VPN not connecting",
  "priority": "P3",
  "status": "in_progress",
  "requester": { "id": "uuid", "name": "Alex" },
  "assignee": { "id": "uuid", "name": "Sam" },
  "asset": { "id": "LAPTOP-001", "model": "Dell Latitude 5520" },
  "sla": { "policyId": "uuid", "dueAt": "2025-08-12T16:30:00Z", "breach": false },
  "createdAt": "...",
  "links": [{"type":"blocked_by","ticketId":"INC-000012"}]
}
```
```json
// Service Item (with dynamic form)
{
  "id": "sc-2",
  "name": "Hardware Request",
  "approvalRequired": true,
  "formSchema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "deviceType": {"type":"string","enum":["Laptop","Monitor","Phone"]},
      "justification": {"type":"string","minLength":20}
    },
    "required":["deviceType","justification"]
  }
}
```

### 4.5 Pagination, Filtering, Sorting
- **Pagination**: default `pageSize=25`, max `100`. Cursor mode for long lists: `cursor` + `limit`.
- **Filters**: `status`, `priority`, `queueId`, `mine`, `createdFrom/To`, `search`.
- **Sorting**: `createdAt`, `updatedAt`, `priority`, `sla.dueAt`.

### 4.6 Webhooks
- Events: `ticket.created`, `ticket.updated`, `ticket.commented`, `ticket.sla.breached`, `request.approved`, `request.rejected`, `kb.published`.
- Delivery: POST with HMAC `X‑Hub‑Signature` header; retries with backoff; dead‑letter queue after N attempts.
- Payload envelope `{ id, event, occurredAt, tenantId, data: {...} }`.

### 4.7 Idempotency
- Clients send `Idempotency-Key` header; server stores hash per tenant/route/body for **24h**. Safe retries return the original response with `Idempotent-Replay: true`.

---

## 5) Frontend Application (Next.js 15 / React 19)

### 5.1 App Structure
```
/apps
  /portal  (end‑user)
  /agent   (admin/agent)
/packages
  /ui      (design system: shadcn/ui wrappers, icons, charts)
  /types   (OpenAPI‑generated types)
  /sdk     (API client, React Query hooks)
  /utils   (auth, tenancy, formatting)
```

### 5.2 Routing (App Router)
- **Portal**: `/`, `/incidents/new`, `/requests/catalog`, `/requests/new/[itemId]`, `/tickets/[id]`, `/kb`, `/kb/[slug]`, `/profile`.
- **Agent**: `/dashboard`, `/queues/[queueId]`, `/tickets/[id]`, `/requests/[id]`, `/approvals`, `/reports`, `/admin` (settings subsections), `/integrations`.

### 5.3 State & Data
- Server Components for initial data + caching; Client Components with TanStack Query for mutations & optimistic updates. Error boundaries per route. Suspense for KB search.
- Forms: React Hook Form + Zod; autosave drafts; file dropzone with pre‑signed URLs; attachment queue.

### 5.4 Accessibility & i18n
- Semantic HTML, ARIA for dynamic components, keyboard focus trapping for dialogs, skip links, *prefers‑reduced‑motion* support, color contrast ≥ AA. i18n translation keys; locales per tenant.

### 5.5 Core Screens & UX Details
- **Create Incident**: short form (summary, description, urgency, asset). Live KB suggestions by query; client‑side dedupe warning (similar open tickets). SLA note.
- **Service Catalog**: tiles with filters (department, popularity, most requested). Item detail: description, lead time, approvers, required fields. Dynamic form from JSON schema.
- **Ticket Detail**: header (number, status, priority, SLA timer), tabs (Activity, Tasks, Attachments, Links, Asset, Audit). Comment composer with canned responses & visibility toggle.
- **Agent Cockpit**: tri‑pane layout (queues → list → preview). Bulk actions: assign, set priority, merge, link, comment private. Keyboard shortcuts.

### 5.6 Design System
- Tokens: spacing/typography/color/radii/shadows. Components: Button, Input, Select, Textarea, Combobox, Dialog, Drawer, Tabs, Table, Badge, StatusPill, SLACountdown, PriorityPicker, AvatarStack, EmptyState, Toast, Breadcrumbs, PageHeader.
- Charts: Recharts for KPIs: TTR, workload, breaches, deflection; export PNG/CSV.

### 5.7 Performance Budgets
- FCP < 2.0s on 3G; TTI < 3.5s; JS bundle per route < 200KB gz (goal). Use RSC streaming, code‑split, image optimization.

---

## 6) Workflow Orchestration (Temporal)

### 6.1 Incident Lifecycle
- **Create → Triage → Assign → In Progress → Resolved → Closed**.
- Rules: category/priority mapping; related open problem alerts; auto‑close after X days if requester silent; reopen transitions.
- **SLA timers**: respond/resolve; pause on `waiting` (customer). Escalation chain (queue → team lead → manager). Breach notifications.

### 6.2 Service Request Fulfillment
- **Request → Approval(s) → Task orchestration → Delivery → Confirmation → Closed**.
- Approval chain defined on service item; parallel approvals when non‑dependent; tasks from `fulfillment_playbook` executed by activities (Graph API, vendor APIs, directory actions).

### 6.3 Playbook DSL (YAML)
- Actions: `graph.createUser`, `graph.assignLicenses`, `intune.assignDevice`, `vendor.createOrder`, `slack.postMessage`, `teams.postMessage`, `email.send`.
- Conditionals: `when`, `unless`; Inputs with templating `{{ }}`. Retries/backoff; idempotency tokens.

### 6.4 Automation Examples
- Network outage link with NOC alert → priority bump, status banner, mass notification.
- Onboarding request → create account, assign licenses, order hardware, create access tickets, notify manager.

---

## 7) Routing, Assignment & Dedupe

### 7.1 Routing Rules
- Map categories/channels to queues; after-hours to on‑call queue; VIP requester → higher priority.

### 7.2 Auto‑Assignment
- Strategies: **round‑robin**, **least‑loaded**, **skill‑based** (tags on agents). Fallback to queue default.

### 7.3 Duplicate Detection
- Near‑duplicate matcher (subject trigram + TF‑IDF on description + same department within last 24h). Suggest merge/relate in UI.

---

## 8) Integrations (Phase‑Gated)

1. **Microsoft 365 / Entra / Graph**: SSO, user pull, mailbox, Teams notifications.
2. **Intune/Jamf/SCCM**: device context; pull asset state into ticket.
3. **Monitoring**: Azure Monitor/Zabbix/Nagios → incident webhooks; attach alert context.
4. **ChatOps**: Teams/Slack slash commands `/new incident ...`; message actions (add comment, close).
5. **Email**: inbound parsing; thread linking; outbounds with templates and reply‑to tokens.
6. **Knowledge**: import SharePoint/Confluence; nightly sync; index refresh.
7. **Remote Assistance**: launch links; session metadata to ticket.

> All via `integrations` adapters. Outbound webhooks: retries + HMAC signatures.

---

## 9) Security, Privacy, Compliance

### 9.1 Authentication
- OIDC code flow + PKCE; refresh token rotation; device/session revocation; tenant mapping by verified email domain or Just‑In‑Time link invite.

### 9.2 Authorization
- RBAC (`end_user`, `agent`, `admin`, `tenant_owner`) + ABAC (department, queue ownership). Policy middleware; deny by default.

### 9.3 Data Security
- TLS 1.2+; at‑rest encryption; secrets in Key Vault; PII minimization; attachment virus scanning; signed URLs.

### 9.4 Tenancy
- Dual enforcement (DB RLS + code). Per‑tenant rate limits. Optional encryption scopes per tenant.

### 9.5 Audit & Compliance
- Full audit trail (who/what/before/after/IP/UA). SOC2 baseline controls; logging retention; DPIA template; data subject export/delete workflows.

### 9.6 Threat Model (STRIDE)
- Spoofing (SSO only, short tokens), Tampering (HMAC webhooks, ETags), Repudiation (audit), Info disclosure (RLS), DoS (rate limits, WAF), Elevation (policy engine + tests).

---

## 10) Observability & Reliability

- **SLIs/SLOs**: latency p95 < 200ms, error rate < 0.5%, availability 99.9%, search freshness < 5m, workflow success > 99%.
- **Tracing**: OTEL spans per request; `x‑request‑id` propagation; link traces across API → workflow → integrations.
- **Logging**: structured JSON with fields `{ts, level, msg, tenant, user, route, status, latency_ms, request_id}`; PII scrubbing.
- **Dashboards**: request rate, saturation, DB health, queue depths, SLA breaches, workflow failures.
- **Alerts**: error budget burn, 5xx spikes, queue backlog, DB CPU, index lag, webhook failures.

---

## 11) Performance & Caching

- **HTTP caching** with ETags on reads; conditional requests. Redis caching for hot lists (queues, catalog) with 30–120s TTL; stampede protection.
- N+1 query guards; Prisma includes/select; DB prepared statements.
- Attachment uploads direct to Blob with pre‑signed SAS; chunked for >50MB.

---

## 12) CI/CD & Environments

### 12.1 Monorepo
- `apps/` (portal, agent, api); `packages/` (ui, types, sdk, utils). pnpm + Turborepo; changesets for versioning SDK.

### 12.2 Pipelines (GitHub Actions)
- **Checks**: typecheck, lint, unit tests, build.
- **API**: generate OpenAPI → publish SDK package.
- **Migrations**: prisma migrate deploy with approval gates.
- **Infra**: Bicep/Terraform plan → apply (gated).
- **Deploy**: Canary to `staging`, smoke tests, then promote to `prod`.

### 12.3 Environments
- **Dev** (shared), **Staging** (prod‑like), **Prod** (multi‑tenant). Feature flags via ConfigCat/LaunchDarkly (OSS: Unleash).

### 12.4 Sample GitHub Action (excerpt)
```yaml
name: ci
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm i --frozen-lockfile
      - run: pnpm turbo run lint test build --cache-dir .turbo
      - run: pnpm --filter @catalyst/api generate:openapi
      - run: pnpm --filter @catalyst/sdk publish --no-git-checks
```

---

## 13) Testing Strategy

- **Unit**: Vitest; target ≥ 80% on core modules; factories + fixtures.
- **API**: Contract tests from OpenAPI (Dredd/Pact) + supertest; negative tests for RLS leakage.
- **E2E**: Playwright across critical journeys: create incident; request with approvals; internal/private notes; breach escalation; email ingestion; SSO login; tenant isolation.
- **Accessibility**: axe‑core checks + manual keyboard flows.
- **Performance**: k6 load tests: 500 RPS mix, p95 targets; search latency; indexer throughput.
- **Chaos drills**: kill worker pods; DB failover; queue backlog; retry logic.

---

## 14) Implementation Plan (90‑Day Build)

### Phase 0 (Week 0)
- Repo scaffold, infra sandbox, SSO hookup, DB baseline w/ RLS, CI skeleton, feature flag plumbing.

### Phase 1 (Weeks 1‑4)
- Portal: incident submission + KB suggest + ticket list/detail.
- Agent: dashboard + queues + triage + comments + attachments.
- API: tickets/comments/attachments; audit; tenancy guard; webhooks MVP.
- Observability: logs/metrics; dashboards; error alerts.

### Phase 2 (Weeks 5‑8)
- Service Catalog + dynamic forms + approvals + tasks/playbooks.
- SLA engine (Temporal) + timers + escalations.
- Search (KB + tickets) + indexer.
- Email ingestion + outbound notifications (email, Teams).

### Phase 3 (Weeks 9‑12)
- Integrations: Entra/Graph; device context; ChatOps; monitoring webhooks.
- Analytics reports; exports; admin settings; role/permission UI.
- Hardening: rate limits, WAF, DR drills, pen test fixes, perf tuning.

**Deliverables per phase**: code, infra manifests, OpenAPI, ADRs, runbooks, tests, demo.

---

## 15) Acceptance Criteria (by Epic)

### 15.1 Incidents
- Create incident with minimal fields; attachments ≤ 25MB; KB suggestions appear within 300ms of typing.
- Ticket visible to requester and assigned queue; SLA timers start; breach emails fire ≤ 60s from breach; audit entry exists; p95 create API < 300ms.

### 15.2 Requests
- Service item renders dynamic form from JSON schema; inline validation; approval chain preview; approver approve/reject with comment; tasks spawn and can be completed/rolled back; closure requires requester confirmation or auto‑close after X days.

### 15.3 Agent Operations
- Bulk assign; merge duplicates; mark comment private; view asset context; quick replies; export CSV; keyboard shortcuts; queue WIP limits.

### 15.4 Search & KB
- Searching “VPN” returns tickets and KB; typo‑tolerant; filters by status/owner/date; KB article preview; index refresh < 5m.

### 15.5 Security & Tenancy
- User from Tenant A cannot access Tenant B resources (automated tests). All writes audited. Role changes take effect on next token. RLS enforced in DB.

---

## 16) Content, UX & Localization Standards

- Short forms; progressive disclosure; helpful helper text; visible statuses; robust empty states; forgiving errors.
- Copy: concise, action‑oriented, low jargon; error messages explain *what happened* and *how to fix*; timestamps shown in user’s local TZ.
- Localization: strings externalized; date/number formats by locale; RTL support flag.

---

## 17) Example Code & Config Snippets

### 17.1 Prisma (excerpt)
```prisma
model Ticket {
  id           String   @id @default(uuid())
  tenantId     String   @map("tenant_id")
  kind         TicketKind
  number       String   @unique
  subject      String
  description  String
  requesterId  String
  assigneeId   String?
  priority     TicketPriority @default(P3)
  status       TicketStatus   @default(open)
  channel      Channel        @default(portal)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  closedAt     DateTime?
  @@index([tenantId, status, priority])
}

enum TicketKind { incident request }
enum TicketPriority { P1 P2 P3 P4 }
enum TicketStatus { open in_progress waiting resolved closed }
enum Channel { portal email api chat }
```

### 17.2 RLS bootstrap (pseudo‑SQL)
```sql
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tickets
USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### 17.3 OpenAPI (fragment)
```yaml
openapi: 3.1.0
info: { title: Catalyst ITSM API, version: 1.0.0 }
paths:
  /v1/portal/incidents:
    post:
      security: [{ bearerAuth: [] }]
      requestBody:
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreateIncident' }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/Ticket' } } } }
```

### 17.4 Terraform (infra excerpt)
```hcl
resource "azurerm_resource_group" "rg" { name = var.rg_name location = var.location }
resource "azurerm_postgresql_flexible_server" "db" {
  name                = "catalyst-db"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku_name            = "GP_Standard_D4s_v3"
}
```

---

## 18) Admin Settings (per Tenant)
- Queues & assignment rules; priorities and categories; SLA targets; business hours/holidays; approval policies; email domains; webhooks; theming; feature flags; roles/permissions; localization; notification templates; data retention.

---

## 19) Analytics & Reporting
- Dashboards: volume by channel, backlog trend, SLA compliance, breaches by category, agent performance, deflection rate, top KB articles, recurring incidents (problem candidates), request lead time.
- Export CSV/Parquet; webhook to BI; nightly rollups; per‑tenant aggregates.

---

## 20) Risk & Mitigations
- **Scope creep** → strict change control, ADRs, feature flags.
- **Tenant leakage** → tenancy tests, RLS, reviews.
- **Workflow complexity** → Temporal DSL + harness, retries, alerts.
- **Integration fragility** → circuit breakers, retries, DLQs, provider rate limits.
- **Search drift** → synonym lists, analyzers, relevance tuning cadence.

---

## 21) MVP Fast‑Track (Firebase/Netlify Option)
- Replace API with Firebase SQL + RLPs; Edge Functions for business rules; storage for attachments; optional Firebase for realtime.
- Keep React apps; swap SDK to Firebase; gate advanced workflows.
- Migration to Prod SaaS: export schema/data → Postgres; replace auth with Entra; re‑point storage; re‑index search.

---

## 22) Handover Package Checklist
- Monorepo scaffold; coding standards; commit hooks.
- OpenAPI spec + generated TS SDK.
- Prisma schema + migrations; seed scripts.
- IaC (Bicep/Terraform) + runbooks.
- Temporal workflows and activities library.
- Playwright E2E suite and fixtures; k6 scripts.
- On‑call/ops guide (SLOs, alert runbooks, DR plan).

---

## 23) Appendix A – Sample Playbook (Onboarding)
```yaml
name: onboarding
triggers:
  request.serviceItemId: sc-new-employee
steps:
  - id: create_account
    action: graph.createUser
    inputs: { name: "{{request.fields.fullName}}", dept: "{{request.fields.department}}" }
  - id: assign_licenses
    action: graph.assignLicenses
    dependsOn: [create_account]
  - id: order_laptop
    action: vendor.createOrder
    inputs: { model: "{{request.fields.deviceType}}" }
  - id: notify_manager
    action: teams.postMessage
    inputs: { channel: "managers", text: "Onboarding started for {{request.fields.fullName}}" }
```

---

## 24) Appendix B – ADRs (examples)
- **ADR‑001**: Modular monolith first, services later.
- **ADR‑002**: Postgres + RLS for tenancy.
- **ADR‑003**: Temporal for orchestrations.
- **ADR‑004**: OpenAPI over GraphQL.
- **ADR‑005**: Next.js (App Router) for SSR/ISR + client hydration.

---

## 25) Appendix C – Domain Model (UML‑ish)
`Tenant 1..* User` — `Tenant 1..* Queue` — `Ticket *..1 Queue` — `Ticket *..1 Requester(User)` — `Ticket 0..1 Assignee(User)` — `Ticket *..* Tag` — `Ticket *..* Attachment` — `Ticket *..* Comment(User)` — `Request 1..1 ServiceItem` — `Request 0..* Approval(User)` — `Ticket 0..1 Asset`

---

## 26) Runbooks (Ops)
- **DB failover**: promote replica, update connection strings, run smoke tests.
- **Queue backlog**: scale workers x2, drain DLQs, replay failed messages.
- **Search reindex**: per tenant or full; throttle to avoid CPU spikes.
- **Breach spike**: verify business hours/holidays; scale Temporal workers.

---

## 27) Go‑Live Checklist
- Custom domains + TLS; SSO domain verification; WAF rules; rate limits; backup schedules; alerting; runbook dry‑runs; seed data; tenant branding; RBAC review; DPIA sign‑off.

---

## 28) Cost Model (high level)
- App Service/AKS, DB (compute/storage), Redis, Service Bus, Search, Blob egress, App Insights. Track per‑tenant cost (FinOps tags) and plan tiers.

---

## 29) Final Notes
- Ship vertical slices, measure, iterate. Keep incident/request split sacred. Invest early in tests, telemetry, and operability.

