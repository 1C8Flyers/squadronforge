# Deployment Guide (NAS)

Set these values for your environment:
- `<DEPLOY_USER>@<DEPLOY_HOST>`
- `<DEPLOY_PATH>` (example: `/srv/docker/squadronforge`)

## 1) Prepare host

1. Install Docker Engine + Docker Compose plugin.
2. Ensure the deploy user can run Docker.
3. Open only required ports on LAN/firewall:
   - `5173` (web)
   - `4000` (api, optional if proxied)

## 2) Clone repository on NAS

```bash
ssh <DEPLOY_USER>@<DEPLOY_HOST>
mkdir -p <DEPLOY_PATH_PARENT>
cd <DEPLOY_PATH_PARENT>
git clone https://github.com/1C8Flyers/squadronforge.git
cd squadronforge
```

## 3) Configure environment

Create runtime env file:

```bash
cp .env.example .env
```

Set strong values in `.env`:
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `API_HOST_PORT` (optional override if `4000` is in use)
- `WEB_HOST_PORT` (optional override if `5173` is in use)
- `VITE_API_URL` (URL browsers should use for API, e.g. `http://<DEPLOY_HOST>:<API_HOST_PORT>`)
- `DATABASE_URL` (if not using default compose network config)
- `REDIS_URL` (if not using default compose network config)

## 4) Configure CAPWATCH credentials per tenant

The app reads `tenant.credentialsRef` and resolves credentials by key.

If `credentialsRef=acme`, set either:
- `CAPWATCH_ACME_CAPID` + `CAPWATCH_ACME_PASSWORD`

or file-based:
- `CAPWATCH_ACME_CAPID_FILE=/run/secrets/acme_capid.txt`
- `CAPWATCH_ACME_PASSWORD_FILE=/run/secrets/acme_password.txt`

For file-based secrets, create files under `docker/secrets` (mounted read-only to `/run/secrets` in `api` and `worker`):

```bash
mkdir -p docker/secrets
printf "%s" "<capid>" > docker/secrets/acme_capid.txt
printf "%s" "<password>" > docker/secrets/acme_password.txt
chmod 600 docker/secrets/*.txt
```

## 5) Build and start

```bash
docker compose up -d --build
```

## 6) Validate deployment

```bash
docker compose ps
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:4000/metrics
```

Optional full smoke test:

```bash
pwsh -File ./scripts/docker-smoke.ps1 -MaxWaitSeconds 120
```

## 7) First login

Use the seeded admin credentials from `.env` on:
- `http://<DEPLOY_HOST>:5173/login`

Then create/update tenants in Admin and set each tenant `credentialsRef` to match provided CAPWATCH keys.

## 8) Upgrade procedure

```bash
cd <DEPLOY_PATH>
git pull
docker compose up -d --build
```

## 9) Shutdown / rollback

Shutdown:

```bash
docker compose down
```

Rollback to prior commit:

```bash
git log --oneline
git checkout <commit>
docker compose up -d --build
```

## Notes

- Do not commit `.env` or credential files.
- For internet exposure, front `web`/`api` with HTTPS reverse proxy.
- `db` and `redis` are internal-only by default (not published to host ports).
