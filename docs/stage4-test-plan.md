# Garmops Stage 4 Test Plan

Stage 4 is a verification and failure-mode exercise. It does not authorize new
business features, live PayU charges, real customer data, transactional email,
commits, or pushes.

## Test controls

- Frontend under test: `/Users/rahul/garmops`
- Backend under test: `/Users/rahul/garmops-medusa`
- Test identities: synthetic `stage4+<case>@example.test` identities only.
- Payment mode: PayU test environment and repository test doubles only.
- File fixtures: synthetic clean, oversized, MIME-spoofed, pending, infected,
  and scanner-unavailable fixtures only.
- PASS requires observable evidence. BLOCKED means the environment or an
  external provider is unavailable; it is not a pass.
- Severity: P0 launch blocker, P1 high, P2 medium, P3 low.

## Scenario record format

Every executed scenario is recorded with the following fields. The final
report is the authoritative result ledger.

| Scenario | Preconditions | Steps | Expected result | Actual result | Result | Severity if failed |
|---|---|---|---|---|---|---|
| Example: isolated OTP happy path | Local backend, synthetic email, test OTP exposure enabled | Request OTP, read test OTP, verify, navigate account, logout | One customer session; account loads; logout clears access | Replace during execution | NOT RUN | P1 |

## Automated baseline and regression

| Scenario | Preconditions | Steps | Expected result | Actual result | Result | Severity if failed |
|---|---|---|---|---|---|---|
| Frontend typecheck/lint | Frontend checkout | Run `npm run typecheck` and `npm run lint` | Zero errors | Baseline passed | PASS | P1 |
| Frontend unit suite | Frontend checkout | Run `npm test` | All tests pass; counts recorded | 40 files, 154 tests passed | PASS | P1 |
| Frontend production build | Frontend checkout | Run `npm run build` | Clean production build | Replace after final run | NOT RUN | P1 |
| Backend typecheck/lint | Backend checkout | Run workspace typecheck and lint | Zero errors | Baseline passed | PASS | P1 |
| Backend unit suite | Backend checkout | Run `npm run test:unit --workspace @garmops/backend` | All unit tests pass | 7 suites, 23 tests passed | PASS | P1 |
| Stage 2 HTTP suite | Isolated PostgreSQL; test Redis; test doubles | Run `npm run test:stage2` | All HTTP scenarios pass and cleanup completes | 1 suite, 9 tests passed | PASS | P0 |
| Backend production build | Backend checkout | Run `npm run build` | Deployable Medusa output | Passed | PASS | P1 |
| Docker production image build | Docker available | Build current server/worker image | Build succeeds from current source | Replace after final run | NOT RUN | P1 |

## Customer, authentication, and catalog

| Scenario | Preconditions | Steps | Expected result | Actual result | Result | Severity if failed |
|---|---|---|---|---|---|---|
| OTP happy path | Synthetic customer; test OTP mechanism | Request, consume, verify, navigate account, logout | Session/customer/account work; logout works | Covered by Stage 2 HTTP; browser pass pending | BLOCKED | P1 |
| OTP wrong code | Active challenge | Verify an incorrect code | Safe rejection; no session or identity leakage | Covered by unit/HTTP boundary; detailed abuse run pending | BLOCKED | P1 |
| OTP expired and reuse | Test challenge fixtures | Verify expired code; verify consumed code again | Both rejected; new request follows policy | Covered by auth contract; direct scenario pending | BLOCKED | P1 |
| OTP rate limits/enumeration | Synthetic existing, unknown, and staff emails | Exercise safe request/invalid-verify bursts | Controlled response; no identity classification or stack trace | Direct rate-limit run pending | BLOCKED | P1 |
| Google identity linking | Test provider fixtures | Exercise callback/linking/deduplication tests | Existing same-email customer is reused; no duplicate identity | Provider not contacted locally | BLOCKED | P1 |
| Canonical catalog | Local backend seeded with Stage 3 catalog | Fetch via API and frontend BFF | Ten active products; stable handles; no duplicates | Stage 2 catalog assertion passed | PASS | P1 |
| Invalid product mapping | Test-only invalid mapping | Request product/cart operation | Safe unavailable response; no local price fallback | Frontend unit coverage; HTTP scenario pending | BLOCKED | P1 |

## Configurator, cart, and pricing

| Scenario | Preconditions | Steps | Expected result | Actual result | Result | Severity if failed |
|---|---|---|---|---|---|---|
| Regular configured order | Seeded catalog; synthetic customer | Select product, colour, artwork, print, label, sizes, delivery; add; checkout | Server cart is canonical and line snapshot is complete | API checkout covered; browser flow pending | BLOCKED | P0 |
| Same product twice | Synthetic customer | Add two independent 50-piece configurations; edit/remove one | Two Medusa line IDs; independent config/prices | Unit + Stage 2 cart coverage passed | PASS | P0 |
| Multi-product cart | Seeded tee, hoodie, tote | Add each to one cart | Lines remain independent | Frontend unit coverage; browser run pending | BLOCKED | P1 |
| MOQ per line | Seeded catalog | Attempt 10 + 50 lines; then 50 + 50 | Invalid checkout/payment blocked; valid pair succeeds | Stage 2 and unit coverage passed | PASS | P0 |
| Size allocation validation | Cart line endpoint | Submit lower, higher, negative, unsupported, zero, malformed breakdowns | Backend rejects invalid allocations | Unit/API coverage pending direct matrix | BLOCKED | P1 |
| Dye, Screen Print, DTF, Reflective | Supported product options | Configure each option and checkout in test mode | Option, allowed colours, price, and snapshot persist | Pricing/domain coverage partial; direct E2E pending | BLOCKED | P1 |
| Neck label and file association | Supported label flow and clean fixture | Select label, upload if applicable, checkout | Option/file/pricing/snapshot persist | Direct E2E pending | BLOCKED | P1 |
| Refresh/navigation persistence | Active cart and draft | Refresh, close/reopen, navigate away/back | Committed server lines survive; no stale local overwrite or duplication | Frontend unit coverage partial; browser pending | BLOCKED | P1 |
| Rapid Add to Order | Configurator page | Double-click/rapid click | One intended line only | Direct browser pending | BLOCKED | P1 |
| Slow network/race | Network throttling or delayed test adapter | Edit while responses are delayed | Newest canonical response wins; no corruption | Direct browser pending | BLOCKED | P1 |
| Backend price override | Mock canonical price differs from preview | Add/prepare checkout | Backend value replaces preview; browser total is not trusted | Frontend unit passed | PASS | P0 |
| Volume discount, GST, rush delivery | Test pricing fixtures | Compare separate lines, GST, and surcharge | Per-line tiers and backend totals reconcile | Domain/unit coverage partial | BLOCKED | P0 |

## Sample orders and files

| Scenario | Preconditions | Steps | Expected result | Actual result | Result | Severity if failed |
|---|---|---|---|---|---|---|
| Sample happy path | Sample-enabled catalog; test payment | Product, sample cart, size, checkout, test success | Separate SAM order, history entry, correct price | Stage 2 sample checkout passed | PASS | P1 |
| Sample/configured isolation | Both cart types available | Send each line to the other cart | Requests fail; carts remain unchanged | Stage 2 cart boundary passed | PASS | P1 |
| Supported artwork types | Test R2 double and scanner | Upload PNG/JPG/JPEG/SVG/AI/PDF where allowed; finalize | Authorization, byte/checksum verification, scan gate work | Unit/test-double path pending direct matrix | BLOCKED | P1 |
| Oversize/MIME spoof | Synthetic invalid fixtures | Upload oversized and extension/content mismatches | Rejected; no usable orphan record | Quarantine unit coverage; direct API pending | BLOCKED | P1 |
| Malware states | Scanner test double | clean, pending, infected, unavailable | Only clean proceeds; all unsafe states fail closed | Quarantine unit passed | PASS | P0 |
| R2 failure and private ownership | R2 test double; two synthetic customers | Fail auth/finalize/download; cross-access A files as B | Recoverable failure; no order mutation; ownership denied | Direct failure/IDOR matrix pending | BLOCKED | P0 |

## Checkout, payments, orders, invoices, and recovery

| Scenario | Preconditions | Steps | Expected result | Actual result | Result | Severity if failed |
|---|---|---|---|---|---|---|
| Address, billing, GSTIN, terms | Synthetic Indian addresses and fixtures | Submit valid/invalid shipping, billing, GSTIN, and terms combinations | Rules enforced; accepted versions/timestamp persisted | Validation/unit coverage passed; browser pending | BLOCKED | P1 |
| Server total recheck | Prepared checkout then mutate cart | Attempt payment with stale checkout | Backend recomputes current total and rejects stale state | Stage 2 canonical checkout passed; mutation case pending | BLOCKED | P0 |
| PayU test success | Test credentials/double; no live account | Initiate, callback/webhook, return | One paid GAR/SAM order, job, invoice, notification attempt | Stage 2 success passed | PASS | P0 |
| PayU failure/cancel | Test provider double | Return failed/cancelled | No paid order/job/final invoice; retryable cart | Contract/unit coverage; direct matrix pending | BLOCKED | P0 |
| PayU double-click/refresh/close | Test provider double | Repeat initiate, refresh return, omit browser return | One initiation/completion; reconciliation recovers | Stage 2 idempotency partial; direct matrix pending | BLOCKED | P0 |
| Duplicate/invalid/mismatched events | Test provider double | Replay success; alter signature/amount/environment/cart | One valid completion; invalid events create nothing | Stage 2 duplicate callback/webhook passed; invalid matrix pending | BLOCKED | P0 |
| Callback/webhook race/reconciliation | Concurrent test delivery | Reverse event order; interrupt completion; reconcile | Exactly-once order/artifacts | Stage 2 concurrent idempotency passed | PASS | P0 |
| Order history/detail | Completed synthetic order | Load success/history/detail after clearing checkout state | Canonical order and frozen config load | Stage 2 order completion covered; browser pending | BLOCKED | P1 |
| Invoice PDF/reconciliation | Completed synthetic order | Download and inspect PDF/totals | Seller, GST, HSN, tax, totals, numbers correct | Invoice unit and Stage 2 artifact coverage passed; content inspection pending | BLOCKED | P0 |
| Invoice/R2/notification retry | Failure-injection doubles | Fail artifact/email, retry worker | Same invoice/order/job; no duplicate notification business record | Worker failure injection pending | BLOCKED | P1 |
| Customer mutation after order | Completed order | Attempt customer API mutations | Frozen snapshot immutable | Domain contract coverage; direct HTTP pending | BLOCKED | P0 |

## Customer isolation, Foundry, permissions, and production

| Scenario | Preconditions | Steps | Expected result | Actual result | Result | Severity if failed |
|---|---|---|---|---|---|---|
| Customer A/B IDOR | Two synthetic customers and owned records | Cross-access design/version/cart/line/order/invoice/file/download | All unauthorized requests fail | Stage 2 ownership checks partial; full matrix pending | BLOCKED | P0 |
| Founder and Operations login | Test staff identities | Login, session, orders, logout | Intended role session and data load | Stage 2 Founder/Operations access passed; UI pending | BLOCKED | P1 |
| Customer on Foundry/disabled staff | Customer and disabled staff fixtures | Call Foundry APIs directly | Customer and disabled staff denied | Permissions unit coverage partial | BLOCKED | P0 |
| Foundry order list/detail | Completed synthetic order | List/filter/open order | Correct data; payment payloads not leaked | API contract coverage; UI pending | BLOCKED | P1 |
| Artwork approval gates | clean/pending/infected fixtures | Approve/reject as each role | Only clean finalized files approve; audit exists | Quarantine/permission unit partial | BLOCKED | P0 |
| Production transitions | Synthetic production job | Exercise valid, invalid, reverse, and concurrent updates | State machine permits only valid transitions; no corruption | Production unit passed; concurrency pending | BLOCKED | P0 |
| Refund authorization/idempotency | Paid test-double order | Founder refund, Operations refund, repeat refund | Founder/provider/audit path works; Operations forbidden; no duplicate | Refund and permission unit coverage; HTTP scenario pending | BLOCKED | P0 |
| Frozen config immutability | Completed order | Attempt product, quantity, size, colour, artwork, print, label, price edits | Founder, Operations, and Customer cannot mutate snapshot | Contract/unit coverage; direct HTTP pending | BLOCKED | P0 |

## Infrastructure, deployment, and runtime

| Scenario | Preconditions | Steps | Expected result | Actual result | Result | Severity if failed |
|---|---|---|---|---|---|---|
| Medusa/server restart | Local compose; synthetic pending request | Restart backend; retry request | Controlled temporary failure; recovery; no fallback/order loss | Existing container healthy; controlled restart pending | BLOCKED | P1 |
| Worker restart during jobs | Test pending reconciliation/scan/retry | Restart worker mid-job | Pending work resumes idempotently | Worker process exists; injection pending | BLOCKED | P1 |
| Redis restart | Local Redis and test records | Restart Redis; inspect sessions/locks/cache | Persistent records safe; documented reauth/lock behavior | Container healthy; restart pending | BLOCKED | P1 |
| Neon interruption | Safe connection-failure injection | Interrupt connection during operations | No false success; recovery | External DB; not safely injected locally | BLOCKED | P0 |
| R2/Resend/ClamAV interruption | Test doubles or safe dependency blocking | Fail each dependency during relevant operation | Business state remains valid; retry/fail-closed behavior | Unit contracts partial; live injection pending | BLOCKED | P0 |
| Latest server/worker image | Docker available | Build current production target; boot isolated image | `/health` 200; admin behavior correct; worker starts | Current production containers healthy; fresh image run pending | BLOCKED | P1 |
| Environment contract | Both `.env.example` files | Compare runtime reads to documented placeholders | Required variables documented; no live values or dead Supabase config | Audit in progress | BLOCKED | P1 |

## Security, abuse, observability, performance, and browser coverage

| Scenario | Preconditions | Steps | Expected result | Actual result | Result | Severity if failed |
|---|---|---|---|---|---|---|
| Auth/payment/upload abuse | Safe synthetic request limits | Exercise bounded invalid bursts and unauthorized mutations | Rate limits/authorization are controlled; no stack traces | Direct runtime matrix pending | BLOCKED | P0 |
| Price/MOQ/payment tampering | Test HTTP client | Alter client price, MOQ, total, payment amount, signatures | Backend rejects tampering | Stage 2 canonical/MOQ/payment checks passed; expanded matrix pending | BLOCKED | P0 |
| CORS/cookies/headers | Local production-style server | Inspect preflight, cookie attributes, response headers | Approved origins only; secure cookie/header posture | Header audit in progress | BLOCKED | P1 |
| Secret and client-bundle audit | Both git worktrees; frontend build | Scan tracked source and build output | No backend secrets; publishable key only client-visible | Direct scan pending final build | BLOCKED | P0 |
| Raw errors/request IDs/logging | Invalid requests and test logs | Trigger malformed auth/cart/payment/file/Foundry requests | Safe errors; useful request/payment/order IDs; no secrets | Request-ID middleware present; matrix pending | BLOCKED | P1 |
| Frontend smoke/performance | Production frontend + local backend | Homepage, product, configurator, checkout, account | No severe regression; no request storm; large cart/upload usable | Browser runtime unavailable in baseline | BLOCKED | P2 |
| Browser matrix | Playwright/desktop browsers available | Chrome, Safari, Firefox, Edge; mobile public pages | Auth/configurator/upload/checkout/Foundry behave as intended | Not run | BLOCKED | P1 |
| Multi-tab/back-button | Two browser tabs; synthetic account | Concurrent cart edits, checkout back/refresh, staff transitions | No duplicate lines/orders or invalid state | Not run | BLOCKED | P1 |
| Database integrity/orphans | Isolated test database | Verify linked records after success/failure cases | Expected relationships; no unexpected orphans; exactly-once artifacts | Stage 2 artifact assertions partial | BLOCKED | P0 |

## Completion gate

Stage 4 may be declared complete only after all P0/P1 scenarios are PASS or
explicitly resolved with regression evidence. External manual wiring and the
explicitly authorized live-payment smoke test remain launch gates even when
local code verification passes.

## Stage 4.1 execution record — 2026-08-14

The following commands were executed against the frontend checkout at
`/Users/rahul/garmops` and this backend checkout:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:stage2
./scripts/test-stage41-browser.sh
```

The browser harness uses the isolated `garmops-stage41-browser` Compose
project, PostgreSQL port `55433`, Redis port `56379`, backend port `19000`,
and frontend ports `13000`/`13001`. Cleanup is scoped to that project and its
named volume.

Observed browser results:

- Customer authenticated sign-in/account/logout and customer-to-Foundry
  denial: 6/6 across Chromium, WebKit, and Firefox.
- Founder and Operations authenticated Foundry access: 2/2 in Chromium.
- One authenticated configured-cart delivery flow: passed.
- Multi-product and same-product allocation flows: passed in isolated
  authenticated Chromium runs. The UI now holds below-MOQ intermediate edits
  locally and leaves the backend validation contract unchanged.
- Broad all-customer harness invocation: interrupted after an orphaned Next
  child left the runner waiting; not counted as a pass. The harness cleanup was
  tightened afterward, and targeted customer/staff/matrix runs were used for
  the recorded evidence.

Failure-injection coverage now includes the guarded points `r2-upload`,
`r2-verify`, `r2-download`, `r2-put`, `r2-read`, `resend`, and `invoice`.
The Stage 2 suite exercised invoice failure followed by authenticated payment
recheck and passed without duplicate order/invoice creation. The other
dependency points have unit coverage and remain candidates for direct browser
or HTTP recovery scenarios.

The test OTP mechanism is fail-closed for production: both test flags and a
non-production environment are required, and the frontend only reads the
returned test code when `GARMOPS_E2E=true`.
