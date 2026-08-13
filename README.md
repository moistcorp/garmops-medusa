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

## Medusa Admin and admin user

Open the bundled Admin at:

<http://localhost:9000/app>

Create an account manually; no credentials are committed:

```bash
docker compose exec medusa npm run admin:create --workspace @garmops/backend -- --email admin@example.com --password 'replace-with-a-strong-password'
```

Use that account to log in at the Admin URL.

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
