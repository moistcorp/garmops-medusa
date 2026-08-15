# Production Environment Checklist

This is an inventory, not a place to store values. Use a secret manager or
deployment environment. Never commit production values.

The names below are the names consumed by the current repositories. Do not
substitute illustrative names such as `PAYU_ENVIRONMENT`, `R2_ENDPOINT`,
`BACKEND_URL`, or `STORE_URL` unless the application code is changed and
verified at the same time.

## Frontend (`/Users/rahul/garmops`)

Required/safe public configuration:

- `APP_SURFACE` / `NEXT_PUBLIC_APP_SURFACE`
- `APP_ENV`
- `APP_TIMEZONE`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CUSTOMER_APP_URL`
- `NEXT_PUBLIC_STAFF_APP_URL`
- `NEXT_PUBLIC_MEDUSA_BACKEND_URL`
- `MEDUSA_PUBLISHABLE_API_KEY` (publishable; not a secret)
- `NEXT_PUBLIC_ACCOUNTS_ENABLED`
- `NEXT_PUBLIC_CLOUD_DESIGNS_ENABLED`
- `CONFIGURATOR_CHECKOUT_ENABLED`
- `SAMPLE_CHECKOUT_ENABLED`
- `STAFF_PORTAL_ENABLED` / `CLOUD_DESIGNS_ENABLED`

Optional browser-safe integrations:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENABLED`
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`

## Backend (`/Users/rahul/garmops-medusa`)

Runtime and database:

- `NODE_ENV=production`, `PORT`, `MEDUSA_BACKEND_URL`, `MEDUSA_WORKER_MODE`
- `DATABASE_URL` (Neon PostgreSQL)
- `REDIS_URL`, `CACHE_REDIS_URL`, `LOCKING_REDIS_URL`
- `DISABLE_MEDUSA_ADMIN`

Origins and authentication:

- `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`
- `FRONTEND_URL`, `FOUNDRY_URL`
- `JWT_SECRET`, `COOKIE_SECRET`, `AUTH_MFA_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`

Payments and notifications:

- `PAYU_ENV=live`, `PAYU_KEY`, `PAYU_SALT`, `PAYU_CALLBACK_URL`
- `RESEND_API_KEY`, `RESEND_FROM`

Files and malware scanning:

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- `R2_S3_ENDPOINT`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_URL`
- `MALWARE_SCANNER_URL`, `MALWARE_SCANNER_TOKEN`, `MALWARE_SCANNER_HOST`,
  `MALWARE_SCANNER_PORT`, `MALWARE_SCAN_TIMEOUT_MS`

Invoice/seller configuration:

- `INVOICE_SELLER_NAME`, `INVOICE_SELLER_GSTIN`, `INVOICE_SELLER_ADDRESS`
- `INVOICE_SELLER_STATE`, `INVOICE_SELLER_PIN`

`PAYU_CALLBACK_URL` is used for both hosted-checkout success and failure
returns and must be the implemented public endpoint:

```text
https://api.garmops.com/garmops/payments/payu/callback
```

Register the separate provider webhook endpoint in PayU's dashboard; it is not
read from an application environment variable:

```text
https://api.garmops.com/garmops/payments/payu/webhook
```

The frontend must receive only `NEXT_PUBLIC_MEDUSA_BACKEND_URL` and
`MEDUSA_PUBLISHABLE_API_KEY`. PayU keys/salt, database, Redis, R2, Resend,
Google, JWT, cookie, and MFA secrets belong only to the backend deployment.

Test-only variables must not be enabled in production:

- `EXPOSE_TEST_OTP`
- `GARMOPS_TEST_DOUBLES`
- `GARMOPS_TEST_MALWARE_RESULT`
- `GARMOPS_TEST_FAILURE`

`GARMOPS_TEST_FAILURE` is only for isolated test doubles and must never be set
in a deployed environment. Accepted local points are `r2-upload`, `r2-verify`,
`r2-download`, `r2-put`, `r2-read`, `resend`, and `invoice`.

## Launch wiring still required

- Provision production Neon, Redis, R2, ClamAV, PayU, Resend, and Google values.
- Register the production PayU callback/webhook URLs.
- Register the production Google OAuth redirect URI.
- Verify the Resend sender/domain.
- Configure R2 bucket policy, CORS, and private signed-object behavior.
- Configure backend/frontend DNS, TLS, reverse proxy, and approved CORS origins.
- Confirm secret rotation, backups, monitoring, and rollback access.
- Verify the production Neon project/branch identity before migrations; never
  use a reset, drop, truncate, or development database command against it.
- Generate unique production values for `JWT_SECRET`, `COOKIE_SECRET`, and
  `AUTH_MFA_ENCRYPTION_KEY` with `openssl rand -hex 32`; do not print or commit
  the generated values.

## Local verification state

The local environment contract is documented and the rebuilt production image
booted successfully. External production values and provider registrations
remain manual launch gates; no live PayU charge, live refund, or real
production notification was used.
