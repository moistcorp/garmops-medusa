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
verified.
