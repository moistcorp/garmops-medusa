# Stage 3 API contract

This is the implemented Stage 2.4 backend surface. Monetary values are integer
paise. Custom errors contain `code`, `message`, and `requestId` where the route
can safely provide one. Medusa-native routes remain available for native
catalog, auth, cart, payment, and order operations.

## Customer/store APIs

| Method | Path | Actor | Request / response summary |
|---|---|---|---|
| GET | `/store/garmops/catalog` | public | Returns the active canonical catalog and configuration choices. |
| POST | `/store/garmops/pricing` | public | Validated configuration inputs; returns server `pricing` snapshot. Browser prices are never accepted. |
| POST | `/store/garmops/otp/request` | public | `{email}`; returns opaque `challengeId` (test code only in explicit test mode). |
| POST | `/auth/customer/emailotp` | public | `{email, challengeId, code}`; Medusa returns a customer JWT. |
| GET/POST/PATCH | `/store/garmops/designs`, `/store/garmops/designs/:id` | customer | Owned design projects and immutable revisions. PATCH requires the current revision. |
| POST | `/store/garmops/designs/:id/duplicate` | customer | Duplicates an owned design; supports client operation idempotency. |
| POST | `/store/garmops/files/upload` | customer | Validated file target, kind, MIME, size and optional checksum; returns a signed upload URL. |
| POST | `/store/garmops/files/:id/finalize` | owner/staff | Verifies object identity/size/checksum and runs the malware gate. |
| GET | `/store/garmops/files/:id/download` | owner | Returns a short-lived private URL only for an owned clean file. |
| GET/POST | `/store/garmops/cart` | customer | `GET` resolves a supplied owned cart; `POST` creates/resolves `cartType=configured|sample`. |
| GET | `/store/garmops/cart/:id` | customer | Canonical cart summary and validation problems. |
| POST | `/store/garmops/cart-profile` | customer | Compatibility profile orchestration for an existing owned native cart. |
| POST | `/store/garmops/cart-lines` | customer | Adds one independently identified configured line. Request contains project/version, sizes and configuration, never authoritative price. |
| PATCH/DELETE | `/store/garmops/cart-lines/:id` | customer | Updates or removes an owned pre-order configured line; validation and price are recalculated. |
| GET/POST | `/store/garmops/sample-cart` | customer | Resolves a sample cart or adds a sample line. Same product/size additions merge; configured lines are rejected. |
| PATCH/DELETE | `/store/garmops/sample-cart/lines/:id` | customer | Updates or removes an owned sample line. |
| POST | `/store/garmops/sample-cart/validate` | customer | Validates sample cart type, availability, line count and per-size limits. |
| POST | `/store/garmops/checkout/prepare` | customer | Persists validated contact, India shipping/billing addresses, GSTIN, legal versions and notes; rechecks cart rules. |
| GET | `/store/garmops/pincode/:pin` | public | Six-digit India PIN lookup/validation. |
| POST | `/store/garmops/payments/payu/initiate` | customer | Derives the amount from the owned, revalidated cart and creates the PayU payment session. Client amount is ignored. |
| POST | `/store/garmops/payments/payu/callback` | PayU | Verifies signature, transaction identity, amount and environment; completion is idempotent. |
| POST | `/store/garmops/payments/payu/webhook` | PayU | Same verification/completion boundary; browser return is not authoritative. |
| GET | `/store/garmops/payments/payu/status?cartId=...` | customer | Returns safe pending/failed/succeeded/order-complete state. |
| POST | `/store/garmops/payments/payu/recheck` | customer | Reconciles an owned verified payment and safely retries artifact completion. |
| GET | `/store/garmops/orders` | customer | Lists only the authenticated customer's orders with public number, totals and production summary. |
| GET | `/store/garmops/orders/:id-or-public-number` | customer | Owned detail with items, frozen snapshots, totals, tracking and invoice metadata. |
| GET | `/store/garmops/invoices/:id` | customer | Owned invoice metadata and short-lived private PDF URL when issued. |
| GET | `/store/garmops/invoices/:id/download` | customer | Alias of invoice retrieval with ownership and private-file checks. |
| POST | `/auth/session` | authenticated customer | Native Medusa session materialization. |
| DELETE | `/auth/session` | authenticated customer | Native Medusa session invalidation. |

Configured lines reject inactive products, stale/mismatched design versions,
invalid sizes/quantities, per-line MOQ failures, custom-dye MOQ failures,
invalid colors/techniques/reflective colors, unowned files, and invalid delivery
options. Configured lines never merge. A completed cart cannot be changed.

## Foundry APIs

Staff authentication uses Medusa's native `emailpass` provider and user actor:
`POST /auth/user/emailpass` and `POST /auth/user/emailpass/register` are the
provider surfaces. Accounts are manually provisioned by the CLI only. The
Garmops staff record maps the Medusa user ID to exactly `founder` or
`operations`; customer/staff email collisions are rejected.

| Method | Path | Actor | Request / response summary |
|---|---|---|---|
| GET | `/foundry/staff` | founder/operations | Safe current staff identity. |
| GET | `/foundry/session` | founder/operations | Safe current staff identity. |
| DELETE | `/foundry/session` | founder/operations | Invalidates the current session cookie. |
| GET | `/foundry/orders` | founder/operations | Operational order list from production jobs. |
| GET | `/foundry/orders/:production-job-id` | founder/operations | Order, customer-facing details, production job, snapshots and invoice metadata. |
| POST | `/foundry/orders/:id/artwork-review` | founder/operations | `{fileId, decision: approve|reject}`; clean finalized files only; creates audit history. |
| POST | `/foundry/orders/:id/status` | founder/operations | `{status, reason?}`; only domain state-machine transitions are accepted. |
| GET | `/foundry/payments/:id` | founder | Safe payment inspection; raw provider secrets are never returned. |
| POST | `/foundry/payments/:id/refund` | founder | `{amountPaise?, idempotencyKey}`; provider-backed/idempotent refund boundary. |
| POST | `/foundry/staff` | founder | Deliberately returns `405`; provisioning remains CLI-only. |
| POST | `/foundry/files/:id/approve` | founder/operations | Approves a clean finalized file and records review metadata. |
| GET | `/foundry/files/:id/download` | founder/operations | Short-lived private clean-file URL. |

Operations can view orders, review artwork and make valid production
transitions. Operations cannot refund, manage staff, manage promotions, inspect
raw payments, change prices, or mutate frozen configuration. Founder-only
management surfaces remain denied to operations.

## Completion and immutability

Verified PayU success runs the existing completion workflow under a cart lock,
then creates exactly one Medusa order, a `GAR-YYYY-######` or
`SAM-YYYY-######` number, frozen configuration snapshots, one production job,
one GST invoice/PDF artifact, and one notification event. Duplicate callback,
webhook, and reconciliation deliveries are no-ops after completion. Invalid
signatures and amount mismatches do not create paid orders or production
artifacts.

Native order configuration is represented by the immutable Garmops snapshot;
Garmops routes do not expose commercial/configuration mutation after completion.
Refund, cancellation, fulfillment, tracking, and production status are
separate operational actions.
