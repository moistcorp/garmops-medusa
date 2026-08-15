# garmops-medusa

Backend for Garmops. This repository contains a Medusa v2 backend only; the
customer-facing `garmops` frontend remains a separate repository.

## Architecture

- Medusa v2.19.0 backend and bundled Medusa Admin
- Neon PostgreSQL for authoritative relational data
- Redis 7 for sessions and Medusa runtime infrastructure
- Docker Compose for local development and portable server deployment

There is deliberately no storefront container. The Stage 2 backend includes a
Garmops Medusa module, server-side pricing/catalog rules, design versions,
production records, private R2 upload flow, PayU/Resend providers, and
environment-driven authentication configuration.

## Requirements

- Docker Desktop (running)
- Git

Neon provides PostgreSQL, and Redis is provided by Docker. Developers do not
need to install PostgreSQL or Redis on the host.

## First-time startup

```bash
cp .env.example .env
# Set DATABASE_URL to the Neon pooled PostgreSQL URL supplied by your project.
# Replace the JWT_SECRET and COOKIE_SECRET placeholders with random values.
npm install
docker compose up --build -d
```

The committed `.env.example` contains placeholders only. The local `.env` is
ignored by Git and is already suitable for this checkout.

## Normal startup and operations

```bash
# Start Redis and the Medusa development server connected to Neon.
npm run docker:up

# Stop containers without deleting database or Redis volumes.
npm run docker:down

# Follow all service logs.
npm run docker:logs

# Check the backend.
curl -i http://localhost:9000/health
```

Only Redis is bound to localhost for optional debugging. Neon PostgreSQL is
accessed through DATABASE_URL and is not exposed by this Compose setup.

## All-local portable stack (customer, Foundry, and backend)

For Mac testing or a self-contained Hyper-V Ubuntu host, clone `garmops` and
`garmops-medusa` beside one another, then run this from `garmops-medusa`:

```bash
./scripts/portable-up.sh
./scripts/portable-smoke.sh
```

Docker is the only application runtime required on the host. The startup script
creates an ignored `.env.portable` with random infrastructure secrets, builds
both repositories, starts persistent PostgreSQL/Redis/ClamAV volumes, applies
migrations, bootstraps the 10-product catalog, creates and shares the Medusa
publishable key, and starts these loopback-only services:

- Customer/configurator: <http://localhost:3000/configurator>
- Foundry: <http://localhost:3001>
- Medusa Admin: <http://localhost:9000/app>
- Medusa health: <http://localhost:9000/health>

Routine restarts preserve data:

```bash
./scripts/portable-up.sh
docker compose --env-file .env.portable -f docker-compose.portable.yml down
```

Do not add `-v` to the down command unless you intentionally want to erase the
portable PostgreSQL, Redis, ClamAV, and generated-key volumes. Create Medusa
Admin and Foundry users after first startup using the commands below. Before
putting the stack behind Cloudflare Tunnel, update `.env.portable` with HTTPS
application/API origins, matching CORS origins, strong external-service
credentials, and the real callback URLs; then rebuild the stack.

### Hyper-V Ubuntu and the existing Cloudflare Tunnel

Keep both repositories beside one another on the Ubuntu VM. Copy the existing
Mac tunnel `config.yml` and its credential JSON into
`garmops-medusa/cloudflare/`; change `credentials-file` in the copied config to
`/etc/cloudflared/<tunnel-id>.json`. The existing
`url: http://127.0.0.1:9000` remains valid because the tunnel container uses
Linux host networking. Then start everything, including the tunnel, with:

```bash
PORTABLE_WITH_TUNNEL=1 ./scripts/portable-up.sh
./scripts/portable-smoke.sh
```

If the Windows host must open the dashboards directly through the VM address,
set `BIND_ADDRESS=0.0.0.0` and set `CUSTOMER_APP_URL`, `STAFF_APP_URL`, CORS,
and callback values in `.env.portable` to the Ubuntu VM's stable IP. Keep the
Windows/Ubuntu firewalls limited to the private Hyper-V network. The safer
default binds all three HTTP ports to the VM's own loopback interface.

The tunnel is optional on the Mac, where the existing host `cloudflared`
process can continue using port 9000. On Ubuntu, enable Docker at boot once
with `sudo systemctl enable --now docker`; every long-running service uses a
restart policy, so subsequent VM boots do not require starting Node, Medusa,
PostgreSQL, Redis, or Cloudflare separately.

## Medusa Admin and admin user

Open the bundled Admin at:

<http://localhost:9000/app>

Create an account manually; no credentials are committed:

```bash
docker compose --env-file .env.portable -f docker-compose.portable.yml exec medusa-server \
  npm run admin:create -- --email admin@example.com --password 'replace-with-a-strong-password'
```

Use that account to log in at the Admin URL.

Create a Foundry staff account without putting its password in shell history:

```bash
printf '%s' 'replace-with-a-strong-password' | \
  docker compose --env-file .env.portable -f docker-compose.portable.yml exec -T medusa-server \
  npx medusa exec ./src/scripts/create-staff.js -- --email founder@example.com --role founder \
  --display-name 'Founder' --password-stdin
```

## Database migrations

Medusa owns the schema through its migration system. Do not create Medusa
tables manually.

```bash
# Run pending Medusa migrations and sync links.
npm run db:migrate

# Generate a migration for a named custom module later.
npm run db:generate -- <module-name>
```

The migration command runs against the Neon database in DATABASE_URL. Do not
manually create Medusa tables. Normal restarts and `docker compose down` do not
affect Neon data.

The following command is intentionally destructive only to local Redis state;
it does not reset or delete the authoritative Neon database:

```bash
npm run redis:reset
docker compose up --build -d
```

Any Neon database reset must be performed intentionally and separately through
the Neon project tooling. It is not automated by this repository.

## Production build and server/worker modes

The official Medusa production build is:

```bash
npm run build
```

It writes the deployable application to `apps/backend/.medusa/server`.

The same source tree and production image support both instances:

```bash
# Build and run the server (Admin enabled) and worker (Admin disabled).
docker compose --profile production up --build -d redis medusa-server medusa-worker

# Stop the production-profile services without deleting volumes.
docker compose --profile production down
```

The server uses `MEDUSA_WORKER_MODE=server`; the worker uses
`MEDUSA_WORKER_MODE=worker`. Local development defaults to `shared` mode.

## Useful files

- `apps/backend/medusa-config.ts` — environment-driven Medusa configuration
- `docker-compose.yml` — Redis, development server, and production server/worker services
- `Dockerfile` — multi-stage, ARM64/AMD64-portable image build
- `.env.example` — safe environment template
- `docs/architecture.md` — long-term system boundary

## Stage 2 status

The backend migration is implemented in this repository. Run these checks after
a fresh checkout or deployment:

```bash
npm run typecheck
npm run test
npm run build
npm run catalog:bootstrap
```

The catalog bootstrap is idempotent and creates the 10 canonical active
products. Production payment/order completion, malware-scanner deployment, and
invoice PDF generation still require the corresponding external credentials or
service wiring described in `docs/operations.md`.

## Scope boundary

`garmops` is the separate frontend repository and must not be placed inside
this backend repository. The frontend’s Supabase runtime is not used by this
backend; Medusa, Neon, Redis, R2, PayU, Resend, and Medusa Auth are the backend
boundary.
