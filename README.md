# SquadronForge

Multi-tenant CAPWATCH ingestion platform with Vue 3 + Express + Prisma + BullMQ.

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

Example for `rockford`:

- `CAPWATCH_ROCKFORD_CAPID=123456`
- `CAPWATCH_ROCKFORD_PASSWORD=super-secret`

Tenant row should set `credentialsRef=rockford`.

For local Docker Compose, example secret files are mounted from:

- [docker/secrets/rockford_capid.txt](docker/secrets/rockford_capid.txt)
- [docker/secrets/rockford_password.txt](docker/secrets/rockford_password.txt)

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
   - tenant filename override support (`fileMappingJson.membership`, `fileMappingJson.dutyPosition`)
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
- Mobile-first table fallbacks (stacked cards) for members, sync runs, and duty positions
- Auth/session hardening basics:
   - `/auth/logout` endpoint
   - `/auth/refresh` endpoint with refresh-token rotation and DB revocation
   - frontend logout action + token cleanup
   - automatic 401 handling and redirect to login
   - safe user payloads (no password hash in API responses)
- Tenant-scoped Prisma helper used in tenant routes to enforce `tenantId` filtering at data-access layer
- Pagination controls on members and duty positions pages (wired to API pagination)
- `/metrics` includes per-tenant last sync timestamps/status

Additional API endpoints now available:

- `GET /tenant/:slug/settings`
- `PATCH /tenant/:slug/settings`
- `GET /tenant/:slug/members/export.csv`
- `GET /tenant/:slug/duty-positions`
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
