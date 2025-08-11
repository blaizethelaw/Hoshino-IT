# Catalyst ITSM – End‑to‑End Deployment Guide (Unified, Expanded)

> This master runbook unifies the **Full Build Guide**, **Gemini/Supabase instructions**, and **Small‑Business/ITIL deployment notes** into one exhaustive, opinionated path from zero → production. It includes two delivery tracks and a migration bridge between them, plus IaC stubs, environment matrices, SSO/email/search/workflow wiring, observability/SLOs, cost controls, runbooks, audit & compliance, and rollback.
>
> **Track A (MVP Fast‑Track)** — *Supabase + Netlify* (quickest to value)
>
> **Track B (Production SaaS on Azure)** — App Service (or AKS) + PostgreSQL + Redis + Service Bus + Blob + Cognitive Search + Entra ID + Temporal
>
> **Bridge** — deterministic migration plan from Track A → Track B with data export, auth swap, and DNS cutover.

---

## 0) Scope, Environments, Naming, and Change Control

### 0.1 Environments

- `dev` (shared): rapid iteration, permissive CORS, fake email.
- `staging` (prod‑like): production settings, feature flags gated, real SSO on staging tenant, synthetic data.
- `prod` (multi‑tenant): hardened; strict secrets, vNet/private endpoints (Track B).

### 0.2 DNS & Certificates (per env)

- Web (Portal/Agent): `app(.stg).yourco.com`
- API: `api(.stg).yourco.com`
- Assets (public CDN): `cdn(.stg).yourco.com`
- Temporal UI (internal only): `temporal(.stg).yourco.com`
- Certificates: automated via Netlify (Track A) or Key Vault/Front Door (Track B). Enforce HSTS and OCSP stapling.

### 0.3 Resource Naming (Azure)

`rg-catalyst-<env>`, `pg-catalyst-<env>`, `redis-catalyst-<env>`, `sb-catalyst-<env>`, `strgcat<env>`, `kv-catalyst-<env>`, `fd-catalyst-<env>`, `mi-catalyst-<env>` (managed identity).

### 0.4 Git/Release Hygiene

- Branches: `main` → prod, `release/*` → staging candidates, `feat/*` → dev.
- Tags: `vX.Y.Z` at prod release, immutable.
- **Change Control:** ADRs for infra/auth/search changes; migration plans attached to PR; rollback plan required for prod changes.

---

## 1) Prerequisites & Access (All Tracks)

- **Domains/DNS** provider access (TXT for SSO domain verification, CNAME/ALIAS for web/api).
- **Cloud**: Azure subscription (Owner or Contributor + User Access Admin), Netlify + Supabase orgs for Track A.
- **SSO**: Entra ID admin rights to create two app registrations (SPA/Web + API) and assign group claims.
- **Email**: Microsoft 365 tenant mailbox (e.g., `helpdesk@yourco.com`), ability to grant Graph permissions.
- **Secrets**: Azure Key Vault (Track B) or Netlify/Supabase env managers (Track A).
- **CI**: GitHub org with OIDC trust to Azure subscription (Track B) and to Netlify/Supabase (Track A).

> Tip: Create a shared *Deployment Owners* group; only members can approve prod deploys and rotate secrets.

---

## 2) Configuration Matrix (Apps & Workers)

| Key                                | Portal/Agent | API | Worker | Default                       | Notes                                                  |
| ---------------------------------- | ------------ | --- | ------ | ----------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`              | ✅            | —   | —      | `https://api.stg.yourco.com/` | Origin of API per env                                  |
| `NEXT_PUBLIC_APP_ENV`              | ✅            | —   | —      | `staging`                     | Feature flags & logging                                |
| `DATABASE_URL`                     | —            | ✅   | —      | —                             | Postgres (Track B) or Supabase DSN (Track A)           |
| `REDIS_URL`                        | —            | ✅   | —      | —                             | Azure Cache for Redis (Track B)                        |
| `BLOB_CONN` / `BLOB_SAS_*`         | —            | ✅   | —      | —                             | Storage connection or SAS credentials                  |
| `SEARCH_ENDPOINT`/`SEARCH_KEY`     | —            | ✅   | —      | —                             | Azure Cognitive Search                                 |
| `SERVICE_BUS_CONNECTION`           | —            | ✅   | —      | —                             | Domain events (Track B)                                |
| `TEMPORAL_ADDRESS`                 | —            | ✅   | ✅      | `localhost:7233`              | Temporal server endpoint                               |
| `JWT_SECRET`                       | —            | ✅   | —      | —                             | Only if API mints proprietary tokens                   |
| `OIDC_ISSUER`/`CLIENT_ID`/`SECRET` | ✅            | ✅   | —      | —                             | Entra ID (Track B) or Supabase provider keys (Track A) |
| `EMAIL_PROVIDER` + creds           | —            | ✅   | —      | `graph`                       | SMTP/SendGrid/Graph                                    |
| `WEB_BASE_URL`                     | ✅            | ✅   | —      | `https://app.stg.yourco.com`  | Deep links in emails                                   |
| `FILE_MAX_MB`                      | ✅            | ✅   | —      | `25`                          | Shared upload size limit                               |

> Store secrets in **Key Vault** (Track B) or Netlify/Supabase config stores (Track A). Rotate at least quarterly or on personnel change.

---

## 3) Track A — MVP Fast‑Track (Supabase + Netlify)

### 3.1 Provisioning Steps

1. **Create Supabase project** `catalyst-<env>`:
   - Enable Auth (email/password). Add Azure AD provider when ready; map groups → roles.
   - Create storage buckets: `attachments`, `avatars`; set public read off; enable signed URLs.
   - Apply SQL schema for: `tenants`, `users`, `tickets`, `ticket_comments`, `ticket_attachments`, `service_categories`, `service_items`, `kb_articles`, `approvals`, `business_hours`, `sla_policies`.
   - Enable **RLS** on all tenant‑bound tables; add policies (examples in Appendix A).
   - (Optional) Create **Edge Functions**: `email-ingest`, `alerts-webhook`, `search-index-sync`.
2. **Netlify sites**:
   - Connect monorepo; create two sites: `portal` and `agent` (or single site with routes).
   - Build cmd per app: `pnpm i --frozen-lockfile && pnpm --filter @catalyst/portal build`.
   - Publish dir: `.next` (SSR) or `out` (static export).
   - Set env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_ENV`, Supabase public anon key.
3. **API** options:
   - **Option A:** use Supabase generated REST + RPC with RLS. Add a thin Netlify Function gateway for validation, idempotency, audit, and webhooks.
   - **Option B:** deploy the Node API (from scaffold) as Netlify Functions—keeps parity with Track B contracts.

### 3.2 Security Defaults

- Strict CORS (only `app(.stg).yourco.com`); CSP with nonce; disable inline scripts where possible.
- Signed URLs for all file downloads; deny `application/x-msdownload`, `application/x-sh`, and executable types.
- Rate limits in the gateway function (IP + user key). Log and block abusive IPs.

### 3.3 CI/CD

- Netlify: build on PR (deploy previews) + `main` (staging/prod). Required status checks: `lint`, `typecheck`, `unit`.
- DB migrations: commit under `/db/migrations`; GitHub Action runs `supabase db push` to staging, manual promotion to prod.
- Rollback: redeploy previous build; apply down migration (if necessary) or restore snapshot.

### 3.4 Email & ChatOps

- Outbound: SMTP or SendGrid to start; set DKIM/SPF/DMARC.
- Inbound: SendGrid Inbound Parse → Netlify Function → append comment to ticket by `Message-Id` + subject tag (e.g., `[INC-000123]`).
- (Optional) Slack/Teams via Incoming Webhooks for breach notifications.

### 3.5 Observability

- Netlify analytics for traffic; Supabase logs and metrics. Add client OTEL web exporter to emit basic traces to a collector (or Sentry if preferred).

### 3.6 Seed & Smoke

- Seed queues, priorities (P1–P4), SLA targets, business hours, 10 KB articles, 5 catalog items.
- Smoke (`/ops/smoke.http`): login, create incident, attach file, agent comment, search `VPN`, email reply thread.

### 3.7 MVP → Prod Bridge

- Keep JSON schemas for forms and playbooks compatible with the full API.
- Adopt same ticket numbering scheme (`INC-000001`, `REQ-000001`).
- Use UUIDs for all IDs to ensure portability.

---

## 4) Track B — Production SaaS on Azure

### 4.1 Reference Architecture (PaaS First)

- **App Service** (Linux): API (NestJS/Fastify) and SSR frontend (Next.js) on separate apps or combined SSR gateway.
- **Azure Database for PostgreSQL** (Flexible Server, zone redundant), **Azure Cache for Redis**, **Service Bus**, **Blob Storage**, **Cognitive Search**, **Key Vault**, **Application Insights**, **Front Door + WAF**.
- **Temporal**: start on Container Apps or dedicated VM; later move to **AKS**. Optionally use Temporal Cloud.

### 4.2 Minimal Terraform Skeleton

```
/infra
  /modules
    postgresql/
    redis/
    storage/
    servicebus/
    appservice/
    keyvault/
    search/
    frontdoor/
  envs/
    dev/
    staging/
    prod/
```

Provide `plan → apply` pipelines with OIDC to Azure; state in Azure Storage with state locking.

### 4.3 Provisioning Checklist (Scriptable)

1. **Resource Group & KV**: `rg-catalyst-<env>`, Key Vault created; grant `deployer` workload identity `get/list` secrets.
2. **Postgres**: v16, `catalyst` DB, private DNS, firewall *deny public*; extensions: `uuid-ossp`, `pgcrypto`.
3. **Redis**: TLS enabled; min Standard for staging, Premium for prod.
4. **Storage**: containers `attachments`, `exports`; lifecycle: hot → cool (90d) → archive (365d); soft delete on.
5. **Service Bus**: namespace + topic `domain-events`; queues `webhooks`, `emails-inbound`, `webhooks-dlq`.
6. **Cognitive Search**: service with `tickets` and `kb` indexes; synonyms (VPN↔virtual private network); analyzers for en-US.
7. **App Service**: two apps (`catalyst-api-<env>`, `catalyst-web-<env>`); deployment slots `staging`.
8. **Front Door + WAF**: origins (web, api), path‑based routing, rate limiting, OWASP rules, custom 429/403 pages.
9. **Entra ID**: apps `catalyst-api` and `catalyst-web` with redirect URIs; groups/roles claim; configure app roles mapping.
10. **Temporal**: deploy server and Web UI internally; bind to private network; Basic Auth or Entra App Proxy for UI.

### 4.4 App Configuration & Secrets

- Apps read secrets from **Key Vault** via Managed Identity (App Settings reference syntax or SDK).
- API settings to include: `DATABASE_URL`, `REDIS_URL`, `SERVICE_BUS_CONNECTION`, `BLOB_CONN`, `SEARCH_ENDPOINT/KEY`, `TEMPORAL_ADDRESS`, `OIDC_*`, `WEB_BASE_URL`, `FILE_MAX_MB`.
- Enforce **Row‑Level Security** by setting `app.tenant_id` per request and defining RLS policies for every tenant‑scoped table.

### 4.5 CI/CD (GitHub Actions)

- Build: `pnpm turbo lint test build`; generate OpenAPI → publish `@catalyst/sdk` to npm (internal registry ok).
- Deploy: `azure/login` with OIDC → deploy to `staging` slot → run smoke tests → `swap` to `prod`.
- DB: `prisma migrate deploy` after snapshot tag; if failure, `migrate resolve --applied` only with manual approval.

### 4.6 Email (Graph)

- Permissions: `Mail.Send`, `Mail.ReadBasic.All` (or specific mailbox), `offline_access`.
- Outbound: Graph send; inbound: Graph change notifications to webhook `/v1/inbound/email`; verify signatures; correlate `Message-Id`.

### 4.7 Search & Indexing

- Indexer worker subscribes to Service Bus `domain-events` (ticket created/updated, kb published) and updates Cognitive Search; reindex endpoint per tenant.

### 4.8 Workflows (Temporal)

- Worker implements SLA timers (respond/resolve), approval orchestration, and playbooks. Signals from API to pause/resume SLA (waiting on user), mark resolved, etc.
- Use KEDA (on AKS) to autoscale workers on queue depth or workflow activity.

### 4.9 Observability & SLOs

- **SLIs**: p95 latency < 200ms; error rate < 0.5%; workflow success > 99%; search freshness < 5m; indexer lag < 2m.
- App Insights dashboards: latency, 5xx, DB timeouts, Redis hit ratio, queue depths, SLA breaches, index lag.
- Alerts: error budget burn rates, DLQ growth, DB CPU > 80% 5m, Search throttling, Temporal worker failures.

### 4.10 Security Hardening

- **WAF**: OWASP top 10, bot protection, rate limits; block dangerous file types.
- **Network**: Private Endpoints for DB/Storage/Search/SB; deny public network where possible.
- **AuthN/Z**: OIDC only; short token TTL; refresh rotation; RBAC + ABAC enforced server‑side.
- **Data**: TLS 1.2+; at‑rest encryption; virus scanning for uploads; PII minimization; retention policies.
- **Secrets**: rotation schedule; break‑glass procedure; logging of vault access.

### 4.11 Cutover

- Blue/green via slots or parallel App Services; canary 5–10% traffic via Front Door; promote on clean metrics.
- Rollback: swap back; if schema changes incompatible, use **expand/contract** migrations or restore to PITR snapshot.

---

## 5) Database Bootstrap (Shared Pattern)

1. Apply Prisma migrations (Track B) or SQL migrations (Track A) in order.
2. Enable RLS and create policies per table (tenant isolation + role‑based read/write).
3. Seed baseline data: queues, business hours (timezone‑aware), SLA policies (P1–P4), service categories/items, KB articles, canned responses, demo assets.
4. Create service accounts: `indexer`, `notifier`, `email-ingest` with least privilege.

### 5.1 Sample Expand/Contract Migration Plan

- **Expand**: add nullable columns or new tables/indexes. Deploy app reading both shapes.
- **Backfill**: one‑time script to populate new columns.
- **Contract**: flip code paths, drop legacy columns in a later release.

---

## 6) Acceptance Tests & Smoke Suite

**Critical paths (automate with Playwright + **``** scripts):**

1. **Login via SSO** → dashboard visible; token contains groups/roles.
2. **Create Incident (with attachment)** → agent queue receives it; requester gets email; attachment accessible via signed URL.
3. **Create Service Request** → approval flow (parallel where defined) → tasks generated → close with confirmation.
4. **SLA timer breach (synthetic)** → due‑soon + breach notifications; audit entry; status updates.
5. **Search freshness**: new KB article visible within 5 minutes; typo‑tolerant search returns results.
6. **Email reply ingestion** updates ticket thread; attachments parsed and stored.
7. **Tenant isolation**: cross‑tenant access denied by RLS and API tests.

**Performance (k6):** mixed RPS of list/create/search/comment; p95 thresholds enforced; soak test 1h.

---

## 7) Ops Runbooks (Expanded)

### 7.1 DB Failover

- Promote replica; update App Config if not using single endpoint; verify with smoke suite; watch error rate.

### 7.2 Queue Backlog & DLQ

- Scale workers 2×; inspect DLQ; fix root cause; replay messages in batches; monitor idempotency.

### 7.3 Search Index Drift

- Run per‑tenant reindex; throttle concurrency; validate counts; compare sample documents.

### 7.4 SLA Breach Spike

- Check business hours/holiday tables; confirm Temporal worker health; examine `waiting` vs `in_progress` proportions.

### 7.5 Incident Response

- Severity S0–S3; comms templates; status page update; retrospective template with action items.

### 7.6 Backup & Restore Drill

- Quarterly: restore DB snapshot to staging; re‑point app; run smoke & perf spot checks; document RTO/RPO achieved.

---

## 8) Cost & Capacity Planning

- **Drivers**: active tickets/day, average attachments GB, search queries, notification volume, workflow activity.
- **Controls**: request/response caching, Front Door CDN, attachment retention tiers, scheduled reindex windows, worker autoscaling rules.
- **FinOps**: tag resources by env/tenant; monthly cost report; alerts on 20% MoM growth.

---

## 9) Go‑Live Checklist (Expanded)

### 9.1 Technical

- ✅ Domains + TLS active; HSTS set
- ✅ SSO verified in prod tenant; group mapping tested
- ✅ Secrets in Key Vault; access via Managed Identity confirmed
- ✅ DB backups + restore drill passed; PITR verified
- ✅ Webhooks HMAC validated; retries/dlq tested
- ✅ Alerts wired to on‑call; runbook links in alerts
- ✅ Seed data & branding per tenant
- ✅ CSP, CORS, rate limits tested

### 9.2 Org/Process

- ✅ On‑call schedule & rotation; escalation matrix
- ✅ DPA/ToS, privacy policy, audit retention configured
- ✅ Owner for search synonyms & KB curation
- ✅ Training deck for agents and managers

---

## 10) Migration Bridge: Track A → Track B

### 10.1 Data Export

- Export from Supabase: `pg_dump` with schema + data for tenant tables; exclude auth schema if moving to Entra.
- Transform: ensure enum compatibility and `uuid` types.
- Import: `psql` into Azure Postgres; run post‑import validation (counts/hashes).

### 10.2 Auth Swap

- Disable Supabase Auth; enforce Entra ID SSO; map groups → roles; issue tenant‑scoped tokens from API.

### 10.3 Files & Search

- Migrate attachments from Supabase Storage to Azure Blob via azcopy; keep original paths when possible.
- Rebuild Cognitive Search indexes; rehydrate from DB + blobs.

### 10.4 DNS Cutover

- Lower TTL (24h prior) to 300s; switch CNAMEs to Front Door + App Service; monitor; raise TTL after stability.

---

## 11) Security, Privacy, Compliance

- **Threat Model (STRIDE)**: Spoofing (SSO + PKCE), Tampering (HMAC on webhooks, ETags), Repudiation (audit trails), Info Disclosure (RLS + encryption), DoS (WAF + rate limits), Elevation (policy engine + tests).
- **PII/Retention**: tickets 7y, attachments 3y, audit 2y (configurable). Subject access/export & delete workflows.
- **Logging**: structured JSON; PII scrubbing; tenant ID and request ID on every log line; encryption at rest.
- **SAST/DAST**: enable secret scanning; dependency updates; periodic ZAP scan (staging); container vulnerability scans.

---

## 12) Feature Flags & Rollout Strategy

- Use ConfigCat/LaunchDarkly (or OSS Unleash) for risky features (e.g., email ingestion, ChatOps). Gradual rollout by tenant or group.
- Canary: 5–10% traffic via Front Door; measure latency/error; expand if healthy.

---

## 13) Performance Budgets & Tuning

- **Web**: FCP < 2.0s on 3G; TTI < 3.5s; route bundle < 200KB gz; image optimization.
- **API**: p95 < 200ms; DB p95 < 50ms; Redis hit rate > 0.9.
- **Search**: query < 300ms p95; index lag < 2m.
- **Workflows**: timer wake-up jitter < 10s; failure rate < 0.5%.
- Tuning: prepared statements, indexed filters, cache TTL 30–120s with stampede protection.

---

## 14) Operational KPIs (First 30 Days)

- SLA compliance % by priority; mean time to respond/resolve.
- Deflection rate (KB views → reduced incidents).
- Agent utilization & backlog trend; duplicate/merge rate.
- Breach causes (waiting vs workload vs routing).
- Search success rate & zero‑result queries (for synonym tuning).

---

## 15) Troubleshooting Playbook (Quick Wins)

- **Users can’t sign in**: verify Entra app registration redirect URIs; clock skew; group claim present.
- **Attachments fail**: check SAS expiry/permissions; content‑type allowlist; blob firewall/VNet.
- **Search stale**: verify Service Bus indexer subscription; DLQ; rebuild tenant index.
- **Emails missing**: check Graph subscription validity; webhook auth; mail throttling.
- **Temporal not firing**: worker queue name mismatch; TLS address; task queue blocked; activity timeouts.

---

## 16) Training & Handover

- Agent playbook: triage, bulk actions, SLA views, internal notes, approvals.
- Admin playbook: queues, SLAs, business hours/holidays, catalog JSON schemas, playbooks, role mapping.
- Videos/GIFs of core flows; cheat sheets for keyboard shortcuts; glossary (priority vs severity).

---

## 17) Appendices

### Appendix A — Supabase SQL RLS Starters

```sql
-- Tenancy isolation
alter table tickets enable row level security;
create policy tenant_isolation on tickets using (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);
-- End users read own tickets
create policy requester_can_read on tickets for select using (
  requester_id = (auth.jwt() ->> 'sub')::uuid
);
-- Agents/Admins write
create policy agent_can_write on tickets for insert with check (
  exists (
    select 1 from tenant_members tm
    where tm.user_id = (auth.jwt() ->> 'sub')::uuid
      and tm.tenant_id = tickets.tenant_id
      and ('agent' = any(tm.roles) or 'admin' = any(tm.roles))
  )
);
```

### Appendix B — GitHub Actions (Deploy Excerpts)

```yaml
name: deploy-api
on:
  push:
    branches: [ main ]
    paths: [ 'apps/api/**', 'packages/**', 'infra/**' ]
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm i --frozen-lockfile
      - run: pnpm turbo run lint test build --filter @catalyst/api
  deploy:
    needs: build-test
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - uses: azure/webapps-deploy@v3
        with:
          app-name: 'catalyst-api-prod'
          package: 'apps/api/.output'
```

### Appendix C — Entra ID (OIDC) Quick Steps

1. Register ``: expose scopes; add Swagger redirect if used; set `accessTokenAcceptedVersion` as needed.
2. Register `` SPA: add redirect URIs (`/auth/callback`); enable PKCE; configure logout URL.
3. Assign groups/roles; include `groups` claim; map to app RBAC.

### Appendix D — Temporal Minimal Footprint

- Temporal Server with Postgres persistence; UI behind internal ingress; backups of persistence DB; retention set appropriately.
- Worker autoscaling via KEDA on queue depth; alert on workflow failure rate and task queue backlog.

### Appendix E — Email Inbound Handler (Graph)

- Subscribe to `/users/{mailboxId}/messages` with webhook; validate signatures; store subscription IDs; renew before expiry.
- Dedupe threads by `Message-Id`; append as ticket comment; persist attachments to Blob.

### Appendix F — Smoke Suite Example (`/ops/smoke.http`)

```http
### Login (OIDC simulator or bypass for staging)
# GET {{WEB_BASE_URL}}

### Create Incident
POST {{API}}/v1/portal/incidents
Content-Type: application/json
Authorization: Bearer {{TOKEN}}

{ "subject": "VPN down", "description": "Cannot connect", "priority": "P2" }

### Add Comment
POST {{API}}/v1/tickets/{{TICKET_ID}}/comments
Content-Type: application/json
Authorization: Bearer {{TOKEN}}

{ "body": "On it!", "isPrivate": true }
```

### Appendix G — k6 Snippet

```js
import http from 'k6/http';
import { sleep, check } from 'k6';
export const options = { vus: 50, duration: '5m', thresholds: { http_req_duration: ['p(95)<200'] } };
export default function () {
  const res = http.get(`${__ENV.API}/v1/portal/tickets?mine=true&status=open`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

---

This expanded deployment guide is the canonical source of truth for getting Catalyst ITSM live, scaling it, and operating it safely. Keep it versioned, attach ADRs to changes, and revisit SLOs quarterly as usage and expectations evolve.

