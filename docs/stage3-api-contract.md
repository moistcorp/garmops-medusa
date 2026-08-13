# Stage 3 API contract

Native Medusa Store APIs own catalog, customer, cart, payment collection,
orders, and addresses. Garmops extensions use these routes. JSON errors use
code, message, and requestId where available. Monetary values are integer
paise unless a native Medusa response says otherwise.

| Method | Route | Auth | Contract |
|---|---|---|---|
| GET | /store/garmops/catalog | public | Active products, INR prices, sizes, print methods, signature and reflective colours. |
| POST | /store/garmops/pricing | optional | Configuration inputs; returns authoritative price snapshot. |
| POST | /store/garmops/otp/request | public, rate-limited | email; returns opaque challenge ID. |
| POST | /store/garmops/otp/verify | public, rate-limited | challengeId and code; consumes OTP and resolves customer. |
| GET/POST | /auth/customer/google and callback | public OAuth | Medusa Google provider flow. |
| GET/POST/PATCH | /store/garmops/designs | customer | DesignProject and immutable DesignVersion; stale revisions rejected. |
| POST | /store/garmops/designs/id/duplicate | customer | Optional client operation ID; idempotent duplicate. |
| POST | /store/garmops/files/upload | customer/staff | Target, kind, MIME, size, filename, optional SHA-256; signed R2 upload URL. |
| POST | /store/garmops/files/id/finalize | owner/staff | HEAD-verifies object and scan state. |
| GET | /store/garmops/files/id/download | owner/staff | Short-lived private signed URL after ownership and scan checks. |
| POST/PATCH/DELETE | native cart lines plus /store/garmops/cart-lines | customer | Validated configured lines remain independent, including duplicate products. |
| POST | /store/garmops/sample-cart/validate | customer | Size-specific sample validation, max 50 lines and 100 units per size. |
| POST | /store/garmops/checkout/prepare | customer | Contact/address/procurement/terms/date/idempotency; revalidates everything. |
| POST | /store/garmops/payments/payu/initiate | customer | Server-created PayU test/live fields. |
| POST | /store/garmops/payments/payu/callback | provider callback | Hash, amount, currency, transaction, and state verification. |
| POST | /store/garmops/payments/payu/webhook | provider callback | Same verification; repeated events are no-ops. |
| POST | /store/garmops/payments/payu/recheck | customer/staff | Reconcile uncertain state without duplicate order creation. |
| GET | native store orders | customer | Customer-owned GAR/SAM orders and frozen snapshots. |
| GET | /store/garmops/invoices/id/download | customer/staff | Private signed invoice PDF URL. |
| GET | /foundry/orders and /foundry/orders/id | founder/operations | Operational views and frozen production specifications. |
| POST | /foundry/orders/id/artwork-review | founder/operations | Approve/reject/hold artwork, never edit configuration. |
| POST | /foundry/orders/id/status | founder/operations | Valid state transition only. |
| POST | /foundry/orders/id/refund | founder | Provider-backed idempotent refund with audit. |
| POST | /foundry/staff | founder | Manual founder/operations provisioning; rejects customer-email collision. |
| GET | /store/garmops/pincode/pin | public | Six-digit Indian PIN validation and canonical state/city. |

Failed PayU attempts never complete a production order. Full payment is
required. GAR and SAM display numbers remain separate from Medusa IDs.
