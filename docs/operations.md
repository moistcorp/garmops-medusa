# Operations

    npm install
    cp .env.example .env
    npm run db:migrate
    npm run catalog:bootstrap
    npm run backend:dev
    curl -i http://localhost:9000/health

Useful commands:

    npm run docker:up
    npm run docker:logs
    npm run typecheck
    npm run lint
    npm test
    npm run build
    npm run db:generate -- --module garmops

Use MEDUSA_WORKER_MODE=server for the API process and
MEDUSA_WORKER_MODE=worker for the background worker in production. Staff
accounts are manually provisioned; there is no public staff signup or invite
flow. Native Medusa Admin is for Founder/admin use only.

Register GOOGLE_CALLBACK_URL with the OAuth provider. PayU remains in test
mode until callbacks, amount checks, idempotency, and refunds are manually
verified. Register `/garmops/payments/payu/callback` and
`/garmops/payments/payu/webhook`; provider callbacks must not use the
`/store/*` namespace because it requires a publishable API key.
# Stage 2 operations runbook

## Local lifecycle

```bash
cp .env.example .env
# Set DATABASE_URL to the Neon connection string and fill local secrets.
npm run docker:up
docker compose ps
docker compose logs --tail=300 medusa malware-scanner redis
curl -i http://localhost:9000/health
npm run db:migrate
npm run catalog:bootstrap
docker compose down
docker compose up -d
```

The authoritative database is Neon; Compose provides Medusa, Redis, and ClamAV. Do not add a local PostgreSQL service.

## Staff and authentication

```bash
npm run staff:create -- --email founder@example.com --role founder --display-name Founder --password-stdin
npm run staff:create -- --email operations@example.com --role operations --display-name Operations --password-stdin
```

Use `/auth/user/emailpass` for staff and `/auth/customer/emailotp` or Google for customers. Staff provisioning is CLI-only.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration:http
npm run test:integration:modules
```

The backend E2E payment fixture must use PayU test-mode mocks; it must not charge a live account. Verify configured, sample, MOQ failure, duplicate/racing PayU events, Founder Foundry, and Operations permission flows before release.

## Recovery workers

The shared/worker Medusa process schedules PayU reconciliation and malware scan recovery every minute. To inspect logs:

```bash
docker compose logs --tail=300 medusa
```

Reconciliation retries `artifact_pending` payment events. Invoice retry reuses the existing `INV-YYYY-######` record and private R2 key. Scanner retry is bounded at three attempts and fails closed.

## Production modes

```bash
MEDUSA_WORKER_MODE=server docker compose --profile production up --build -d medusa-server
docker compose --profile production up -d medusa-worker
```

Before production, set live PayU callbacks, Google redirect URI, Resend sender, R2 credentials/bucket, seller GST details, CORS, and secret-manager values. Never place them in documentation or commit `.env`.
## Stage 2 verification

Run the isolated backend verification suite with `npm run test:stage2`. It
starts a disposable PostgreSQL database on port 55432, runs unit tests and
HTTP integration tests, and removes only that test database/volume on exit.

Useful focused commands are `npm run test:unit --workspace @garmops/backend`,
`npm run test:integration:http --workspace @garmops/backend`,
`npm run typecheck`, `npm run lint`, and `npm run build`.

Recovery jobs are available through the Medusa worker: `reconcile-payu` retries
verified payment events whose order completion is pending, and
`recover-file-scans` retries files awaiting malware scanning. Invoice and
notification records are idempotent and are retried by the artifact completion
path without creating a second order, production job, invoice, or notification.

Provision staff only with `npm run staff:create --workspace @garmops/backend --
--email person@example.com --role founder|operations --display-name Name
--password-stdin`; credentials are read from stdin and never accepted as CLI
arguments.
