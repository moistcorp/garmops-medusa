# garmops-medusa

Backend for Garmops. This repository contains a Medusa v2 backend only; the
customer-facing `garmops` frontend remains a separate repository.

## Architecture

- Medusa v2.19.0 backend and bundled Medusa Admin
- PostgreSQL 16 for authoritative relational data
- Redis 7 for sessions and Medusa runtime infrastructure
- Docker Compose for local development and portable server deployment

There is deliberately no storefront container and no Garmops business module
or third-party integration in Stage 1.

## Requirements

- Docker Desktop (running)
- Git

PostgreSQL and Redis are provided by Docker; they do not need to be installed
on the host.

## First-time startup

```bash
cp .env.example .env
# Replace the three replace-with-* values in .env with random local values.
npm install
docker compose up --build -d
```

The committed `.env.example` contains placeholders only. The local `.env` is
ignored by Git and is already suitable for this checkout.

## Normal startup and operations

```bash
# Start PostgreSQL, Redis, and the Medusa development server.
npm run docker:up

# Stop containers without deleting database or Redis volumes.
npm run docker:down

# Follow all service logs.
npm run docker:logs

# Check the backend.
curl -i http://localhost:9000/health
```

PostgreSQL and Redis are bound to localhost only for optional debugging. They
are not publicly exposed by this Compose setup.

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

Normal restarts and `docker compose down` preserve the database. The following
command is intentionally destructive: it removes the local PostgreSQL and
Redis Docker volumes and all data in them.

```bash
npm run db:reset
docker compose up --build -d
```

## Production build and server/worker modes

The official Medusa production build is:

```bash
npm run build
```

It writes the deployable application to `apps/backend/.medusa/server`.

The same source tree and production image support both instances:

```bash
# Build and run the server (Admin enabled) and worker (Admin disabled).
docker compose --profile production up --build -d postgres redis medusa-server medusa-worker

# Stop the production-profile services without deleting volumes.
docker compose --profile production down
```

The server uses `MEDUSA_WORKER_MODE=server`; the worker uses
`MEDUSA_WORKER_MODE=worker`. Local development defaults to `shared` mode.

## Useful files

- `apps/backend/medusa-config.ts` — environment-driven Medusa configuration
- `docker-compose.yml` — PostgreSQL, Redis, development server, and production server/worker services
- `Dockerfile` — multi-stage, ARM64/AMD64-portable image build
- `.env.example` — safe environment template
- `docs/architecture.md` — long-term system boundary

## Scope boundary

`garmops` is the separate frontend repository and must not be placed inside
this backend repository. PayU, R2, Resend, Google OAuth, email OTP, customer or
staff logic, Garmops commerce modules, GST invoices, and Supabase removal are
future stages and are not implemented here.
