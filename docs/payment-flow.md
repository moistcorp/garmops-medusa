# Garmops payment flow

PayU is a Medusa Payment Module provider (`pp_payu`). The browser never supplies an authoritative amount and never creates an order.

```text
owned cart
  -> server revalidates cart profile, configured versions, sizes, MOQ, artwork scan state and pricing
  -> create/refresh Medusa payment collection and PayU payment session
  -> browser posts the signed PayU fields to PayU
  -> PayU callback and webhook enter the same verifier
  -> merchant key, environment, response hash, transaction, cart and paise amount are checked
  -> verified session data is marked success
  -> completePayuOrderWorkflow runs Medusa completeCartWorkflow under cart locking
  -> one Medusa order, immutable configuration snapshots, one ProductionJob and one invoice are ensured
  -> PDF is uploaded to private R2 and an idempotent confirmation notification is queued
```

`PaymentEvent.provider_transaction_id` and unique production/invoice/order identifiers make retries safe. Callback and webhook may arrive in either order. A downstream invoice, R2, or email failure leaves the event as `artifact_pending`; `garmops-payu-reconciliation` retries it every minute without creating another order or invoice.

Failed, cancelled, stale, incorrectly signed, unknown, wrong-cart, wrong-environment, and amount-mismatched events never complete a cart. Founder refunds use Medusa's payment module and call PayU's refund command; an idempotency key is required. Operations has no refund permission.

Provider callbacks use the non-store routes `/garmops/payments/payu/callback` and
`/garmops/payments/payu/webhook`, because Medusa's `/store/*` namespace requires
the browser's publishable API key. The legacy `/store/garmops/payments/payu/*`
paths are retained for compatibility but must not be registered with PayU.

Manual production wiring still required: live PayU credentials, callback/webhook registration, and production domain configuration.
