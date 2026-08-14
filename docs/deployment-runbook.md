# Garmops VM and Deployment Runbook

The VM is replaceable compute. Neon is the authoritative relational store, R2
is the authoritative binary store, and Redis/ClamAV are runtime services. No
irreplaceable business data may exist only on VM disk.

## Intended services

- Docker Engine / Compose
- Medusa server (`MEDUSA_WORKER_MODE=server`)
- Medusa worker (`MEDUSA_WORKER_MODE=worker`)
- Redis with persistent runtime volume
- ClamAV with its virus-definition volume
- Reverse proxy/TLS layer, if used by the deployment

External systems:

- Neon PostgreSQL
- Cloudflare R2
- PayU
- Resend
- Google OAuth
- Git hosting/registry and secret manager

## New VM procedure

1. Install the approved Docker Engine/Compose version and TLS/reverse-proxy
   prerequisites.
2. Clone the backend repository at the approved release revision.
3. Restore production environment values from the secret manager. Do not put
   them in the repository or this runbook.
4. Verify `DATABASE_URL` points to the intended Neon project and that the R2,
   Redis, ClamAV, PayU, Resend, and Google settings match the environment.
5. Build the current production target:

   ```bash
   docker compose --profile production build medusa-server medusa-worker
   ```

6. Start infrastructure and application services:

   ```bash
   docker compose --profile production up -d redis malware-scanner
   docker compose --profile production up -d medusa-server medusa-worker
   ```

7. Check service health, logs, and the public reverse-proxy route:

   ```bash
   docker compose --profile production ps
   curl -fsS https://<backend-domain>/health
   ```

8. Confirm CORS, cookies, Google callback, PayU callback/webhook, signed R2
   downloads, Resend sender, and worker scheduling before opening traffic.
9. Run the synthetic launch smoke: OTP, catalog, cart, test payment, order,
   invoice, Foundry access, artwork gate, and test refund.

## Recovery

- Backend process failure: allow the container restart policy to recover it;
  confirm `/health`, logs, and pending worker jobs.
- Worker failure: restart only the worker and run reconciliation/scan inspection;
  idempotency must preserve one order, invoice, job, and notification record.
- Redis failure: restart Redis and verify durable database/R2 records; document
  whether sessions require reauthentication.
- VM loss: provision a new VM, restore env, rebuild/start services, point DNS,
  and run the synthetic smoke. Do not restore business state from VM disk.
- Payment/artifact interruption: run the PayU reconciliation and bounded file,
  invoice, and notification retries; never manually create duplicate artifacts.

## Rollback

1. Stop accepting new traffic at the reverse proxy.
2. Preserve logs, request IDs, provider transaction IDs, and affected order IDs.
3. Roll back to the last approved server/worker image pair.
4. Run database migration compatibility checks before starting the old image.
5. Reconcile pending payments and artifacts.
6. Re-run health and synthetic smoke checks before restoring traffic.
7. Record the incident and keep the failed image available for investigation.

## Operational constraints

- Never run a live PayU charge during deployment verification without explicit
  authorization.
- Never use production customer data as a fixture.
- Never print secrets in logs, issue reports, or shell output.
- Do not delete persistent volumes as part of routine recovery.

## Stage 4.1 isolated browser verification

Run the synthetic authenticated browser gate from the backend checkout:

```bash
./scripts/test-stage41-browser.sh
```

The script creates and removes only its own Compose project and named
PostgreSQL volume. It uses separate local ports and test-only credentials;
keep the production Compose project and its volumes untouched. Failure points
can be exercised with `GARMOPS_TEST_FAILURE` while
`GARMOPS_TEST_DOUBLES=true`; never enable those flags in production.
