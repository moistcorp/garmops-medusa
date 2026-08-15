# Garmops Launch Checklist

Complete with synthetic data first. Do not accept real customer traffic until
all P0/P1 Stage 4 findings are resolved and the payment gate is explicitly
authorized.

## Platform

- [ ] Backend production build and latest server image verified
- [ ] Worker image starts with expected reconciliation, invoice, notification,
      and scan recovery jobs
- [ ] `/health` returns 200 from the deployed server
- [ ] Medusa Admin access verified separately from Foundry role semantics
- [ ] Redis healthy and persistence/restart behavior documented
- [ ] ClamAV healthy and upload failures fail closed
- [ ] Neon connectivity, migrations, backups, and restore procedure verified
- [ ] R2 public/private buckets, CORS, lifecycle, and signed downloads verified

## Application and security

- [ ] Frontend production build/typecheck/lint pass
- [ ] Catalog count and product mapping verified against Medusa
- [ ] OTP happy, wrong, expired, reuse, rate-limit, and logout isolation pass
- [ ] Customer IDOR and Foundry authorization tests pass at HTTP level
- [ ] Configured and sample carts remain isolated
- [ ] MOQ, size, pricing, GST, address, terms, and server total revalidation pass
- [ ] Frozen order configuration is immutable for Customer, Operations, and Founder
- [ ] File ownership, MIME/size validation, scan gate, and failure recovery pass
- [ ] CORS, cookie attributes, security headers, raw-error, and request-ID checks pass
- [ ] Tracked files and client bundle contain no backend secrets
- [ ] Dependency findings are classified; no unexplained Critical or exploitable
      High runtime issue remains
- [ ] Stage 4.1 authenticated browser gate is closed: customer matrix, staff
      matrix, and configured-cart allocation scenarios all pass

## Payments and order artifacts

- [ ] PayU test success/failure/cancel/replay/signature/amount/race/reconciliation
      matrix passes
- [ ] Exactly one order, public number, payment completion, production job,
      invoice, invoice artifact, and notification attempt for a successful test
- [ ] Invoice PDF fields and total reconcile with the paid order
- [ ] Founder refund test-double path passes and is audited
- [ ] Operations refund is forbidden at the server boundary
- [ ] Live PayU credentials and callback registration are verified externally
- [ ] One live-payment smoke test is explicitly authorized before real traffic

## External wiring

- [ ] Production environment inventory completed without values in git
- [ ] Google production redirect URI registered
- [ ] Resend verified sender/domain configured
- [ ] Production backend/frontend domains, DNS, TLS, and reverse proxy configured
- [ ] Monitoring, structured logs, alerts, and access ownership confirmed

## Recovery and rollback

- [ ] VM recreation runbook tested or signed off
- [ ] Database/R2 backup and restore owners confirmed
- [ ] Rollback image/version identified
- [ ] Payment reconciliation and artifact retry procedure documented
- [ ] Incident contacts and customer-support communication path confirmed

### Stage 5 current gate status

**OPEN / DO NOT LAUNCH.** Local frontend/backend gates, isolated HTTP checks,
the authenticated browser gate, and rebuilt image checks are green. Production
VM, Neon identity/migrations, provider configuration, DNS/TLS, Vercel, R2,
Resend, Google, monitoring, backup/restore, and explicit live-payment/refund
authorization remain open until verified with production evidence.

## Release hygiene

- [ ] Final frontend/backend git status reviewed
- [ ] No automatic commit performed
- [ ] No push performed
- [ ] No real customer data used
- [ ] No real transactional email sent
- [ ] No live PayU charge made without explicit authorization

### Stage 4.3 closure status — 2026-08-14

Code and isolated runtime gates are green: frontend/backend static, unit,
build, HTTP, customer/staff browser, cross-browser authentication, Redis
restart, and ClamAV stream checks all passed. Launch remains blocked by
production-only wiring and authorization gates, including dependency findings,
Neon/worker deployment verification, external provider configuration,
monitoring/backups/rollback, and explicit live PayU approval.
