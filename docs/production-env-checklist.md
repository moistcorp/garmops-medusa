# Production Environment Checklist

This is an inventory, not a place to store values. Use a secret manager or
deployment environment. Never commit production values.

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
- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`,
  `POSTHOG_ENABLED`, `NEXT_PUBLIC_ANALYTICS_ENABLED`
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENABLED`
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`

## Backend (`/Users/rahul/garmops-medusa`)

Runtime and database:

- `NODE_ENV`, `PORT`, `MEDUSA_BACKEND_URL`, `MEDUSA_WORKER_MODE`
- `DATABASE_URL` (Neon PostgreSQL)
- `REDIS_URL`, `CACHE_REDIS_URL`, `LOCKING_REDIS_URL`
- `DISABLE_MEDUSA_ADMIN`

Origins and authentication:

- `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`
- `FRONTEND_URL`, `FOUNDRY_URL`
- `JWT_SECRET`, `COOKIE_SECRET`, `AUTH_MFA_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`

Payments and notifications:

- `PAYU_ENV`, `PAYU_KEY`, `PAYU_SALT`, `PAYU_CALLBACK_URL`
- `RESEND_API_KEY`, `RESEND_FROM`

Files and malware scanning:

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- `R2_S3_ENDPOINT`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_URL`
- `MALWARE_SCANNER_URL`, `MALWARE_SCANNER_TOKEN`, `MALWARE_SCANNER_HOST`,
  `MALWARE_SCANNER_PORT`, `MALWARE_SCAN_TIMEOUT_MS`

Invoice/seller configuration:

- `INVOICE_SELLER_NAME`, `INVOICE_SELLER_GSTIN`, `INVOICE_SELLER_ADDRESS`
- `INVOICE_SELLER_STATE`, `INVOICE_SELLER_PIN`

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

## Stage 4.2 verification state

The local environment contract is documented and the rebuilt production image
booted successfully. External production values and provider registrations
remain manual launch gates; no live PayU or real notification was used.
