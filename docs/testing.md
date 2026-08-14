# Backend verification

Stage 2 verification uses Medusa v2.19's `@medusajs/test-utils` integration
runner. The runner creates a database named `medusa-garmops-stage2-integration-<worker>`
inside the disposable PostgreSQL service in `docker-compose.test.yml`, snapshots
it between tests, and drops it with the test volume on exit. It never targets
the development Neon URL.

Run the full local suite with:

```bash
npm run test:stage2
```

The command starts PostgreSQL on `localhost:55432`, uses Redis database 15,
runs unit tests, then runs the HTTP integration suite. `test:unit`,
`test:integration:http`, and `test:e2e` remain available for granular runs.

Vendor boundaries are deterministic in test mode (`GARMOPS_TEST_DOUBLES=true`):

- PayU uses test keys and exercises the real callback/webhook handler. Refund
  commands are recorded instead of sent to PayU.
- R2 uses an in-memory S3-compatible test store. Metadata, byte size, checksum,
  ownership and scan gates remain application logic.
- Resend records notification attempts and does not send email.
- Malware results can be forced with `GARMOPS_TEST_MALWARE_RESULT=clean`,
  `infected`, or `unavailable`.
- Google is not contacted; identity provisioning is tested below the provider
  boundary.

The integration suite must not be run with a production `.env`, live PayU
credentials, customer data, or a shared Neon database. If the Medusa runner
cannot initialize the disposable database, the suite is a failure and must not
be reported as passed.
