# SquadronForge

Multi-tenant CAPWATCH ingestion platform with Vue 3 + Express + Prisma + BullMQ.

## Latest Update (2026-02-18)

- Events module is live with tenant-scoped event CRUD + RSVP (`yes` / `no` / `maybe`).
- Recurrence is live for create/edit (daily, weekly, monthly) with interval, until date, and occurrence count.
- Events UX now uses a list-first flow:
   - New Event form is behind a button.
   - Per-event edit actions are available from the list.
   - Mobile cards include inline RSVP actions for faster response.
- Production deployment currently runs web on `:5173` and API on `:4400` on NAS (`enterprise.local`).

## Monorepo Layout

- `apps/web` - Vue 3 + Vite + Tailwind (TailAdmin-style layout scaffold)
- `apps/api` - Express API, JWT auth, RBAC, Prisma models
- `apps/worker` - BullMQ scheduler/worker
- `packages/shared` - shared zod schemas and types

## Quick Start

1. Copy `.env.example` to `.env` and set secrets.
2. Install dependencies from repo root:
   - `npm install`
3. Generate Prisma client:
   - `npm --workspace @squadronforge/api run prisma:generate`
4. Run migrations:
   - `npm --workspace @squadronforge/api run prisma:migrate`
5. Seed admin + example tenant:
   - `npm --workspace @squadronforge/api run prisma:seed`
6. Start local apps:
   - API: `npm run dev:api`
   - Worker: `npm run dev:worker`
   - Web: `npm run dev:web`

## Docker

Run all services:

- `docker compose up --build`

Implementation notes:

- API production entrypoint resolves to `dist/src/index.js`.
- Worker image runs Prisma client generation during build so `@prisma/client` is initialized at runtime.

Services:
- `web` on `http://localhost:5173`
- `api` on `http://localhost:4000`
- `db` PostgreSQL
- `redis`
- `worker`

Note:
- Local default API port remains `4000`.
- Current NAS deployment uses API host port `4400` and builds web with `VITE_API_URL=http://enterprise.local:4400`.

Docker smoke test (PowerShell):

- [scripts/docker-smoke.ps1](scripts/docker-smoke.ps1)

Run:

- `./scripts/docker-smoke.ps1`

Behavior:

- On failure, the smoke script now prints `docker compose ps` and recent `api`/`db`/`worker` logs for faster diagnosis.
- The smoke script intentionally does not auto-shutdown containers; run `docker compose down` when finished.

## Tenant CAPWATCH Credentials

Do **not** store CAPWATCH password in DB.

Use environment variables per tenant slug:

- `CAPWATCH_<TENANT_SLUG>_CAPID`
- `CAPWATCH_<TENANT_SLUG>_PASSWORD`

Or Docker secret file environment keys:

- `CAPWATCH_<TENANT_SLUG>_CAPID_FILE`
- `CAPWATCH_<TENANT_SLUG>_PASSWORD_FILE`

Credential lookup uses `tenant.credentialsRef` from the database.

Example:

- Tenant `credentialsRef`: `acme`
- CAPWATCH env keys to provide:
   - `CAPWATCH_ACME_CAPID`
   - `CAPWATCH_ACME_PASSWORD`
   - or `CAPWATCH_ACME_CAPID_FILE` + `CAPWATCH_ACME_PASSWORD_FILE`

Tenant row should set `credentialsRef` to the tenant key you provisioned (for example, `acme`).

For local Docker Compose, set the `*_FILE` paths to files under:

- [docker/secrets](docker/secrets)

To add another tenant, add a new `credentialsRef` value in tenant settings and add matching env/file keys.

Deployment instructions:

- [DEPLOYMENT.md](DEPLOYMENT.md)

Auth secrets:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

## Example Rockford Tenant

- `slug`: `rockford`
- `name`: Rockford Composite Squadron
- `orgid`: `1092`
- `unitOnly`: `1`
- `timezone`: `America/Chicago`
- `syncScheduleCron`: `0 */4 * * *`

## Sync Now

Call:

- `POST /tenant/:slug/sync-now`

with a valid JWT for a user assigned to that tenant.

## Current Status

This initial scaffold includes:

- Multi-app monorepo structure
- TailAdmin-style baseline UI layout and pages
- JWT login route + RBAC foundation
- Prisma schema for tenant/user/member/sync runs
- Worker queue + cron-based enqueue loop
- CAPWATCH sync pipeline in worker:
   - stream ZIP download
   - content-type/size validation
   - ZIP extraction + file discovery heuristics
   - merged duty ingestion from both `DutyPosition` and `CadetDutyPositions` files (deduped)
   - transactional member upsert
   - optional duty-position ingestion (`DutyPosition` table)
   - `SyncRun` status/checksum/file metadata persistence
   - temp file cleanup + per-tenant DB advisory lock
- Unit tests for header detection and sample parsing
- Unit tests for auth token helpers and tenant-scope enforcement helpers
- Integration tests for auth + RBAC flows (`login`, `refresh`, `logout`, tenant access allow/deny)
- Integration tests for admin and tenant-settings authorization boundaries
- Integration tests for admin payload validation failures and `/metrics` response shape
- Integration tests for tenant members/duty-position pagination and members CSV export headers/content
- Tenant dashboard includes computed next-run time from tenant cron + timezone
- Duty positions page scaffold wired to `/tenant/:slug/duty-positions`
- Cadet promotions page powered by backend-computed readiness/needs/explain logic
- Reports page with "Cadet next promotion needs" report
- Mobile-first table fallbacks (stacked cards) for members, sync runs, and duty positions
- Installable PWA support (manifest + service worker + mobile install metadata)
- Auth/session hardening basics:
   - `/auth/logout` endpoint
   - `/auth/refresh` endpoint with refresh-token rotation and DB revocation
   - frontend logout action + token cleanup
   - automatic 401 handling and redirect to login
   - safe user payloads (no password hash in API responses)
- Tenant-scoped Prisma helper used in tenant routes to enforce `tenantId` filtering at data-access layer
- Pagination controls on members and duty positions pages (wired to API pagination)
- Sync Runs moved into Settings as the "Sync Log" tab
- `/metrics` includes per-tenant last sync timestamps/status

Additional API endpoints now available:

- `GET /tenant/:slug/settings`
- `PATCH /tenant/:slug/settings`
- `GET /tenant/:slug/members/export.csv`
- `GET /tenant/:slug/duty-positions`
- `GET /tenant/:slug/cadet-promotions`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /admin/tenants`, `POST /admin/tenants`, `PATCH /admin/tenants/:id`, `DELETE /admin/tenants/:id`
- `GET /admin/users`, `POST /admin/users`, `PATCH /admin/users/:id`, `DELETE /admin/users/:id`
- `POST /admin/tenant-users`, `DELETE /admin/tenant-users`

## CI

GitHub Actions workflow:

- [CI workflow](.github/workflows/ci.yml)

CI runs:

- dependency install (`npm ci`)
- Prisma client generation
- API tests
- monorepo build
- Docker Compose smoke test (`scripts/docker-smoke.ps1`)

Next implementation pass should complete:

- CSRF strategy for cookie-based auth mode (if adopted)
