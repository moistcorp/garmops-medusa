import type { MedusaRequest } from "@medusajs/framework/http"
import type { IPaymentModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { completeVerifiedPayuPayment } from "./order-completion"
import { parseRupeesToPaise, paymentEventFingerprint, verifyPaymentResponseHash, type PayuFields } from "../providers/payu/security"
import { paymentCallbackDisposition, paymentLockIsActive } from "../domain/payment"
import { medusaAmountToPaise } from "../domain/money"

type PayuRequest = MedusaRequest & { scope: MedusaContainer; requestId?: string }

export async function processPayuEvent(req: PayuRequest, source: "callback" | "webhook") {
  const fields = req.body as Partial<PayuFields> & Record<string, unknown>
  const key = process.env.PAYU_KEY
  const salt = process.env.PAYU_SALT
  if (!key || !salt || fields.key !== key || typeof fields.txnid !== "string" || typeof fields.status !== "string" || typeof fields.hash !== "string") return { status: 400, body: { code: "INVALID_PAYU_EVENT", message: "Required PayU fields are missing" } }
  if (fields.udf5 && fields.udf5 !== (process.env.PAYU_ENV || "test")) return { status: 400, body: { code: "PAYU_ENVIRONMENT_MISMATCH", message: "PayU environment does not match this deployment" } }
  if (!verifyPaymentResponseHash(fields as PayuFields, salt)) return { status: 400, body: { code: "INVALID_PAYU_HASH", message: "PayU response signature is invalid" } }
  const transactionId = fields.txnid
  const payment = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const mapping = (await service.listPaymentEvents({ provider_transaction_id: transactionId }))[0]
  const attempt = (await service.listPaymentAttempts({ provider_transaction_id: transactionId }))[0]
  if (!mapping?.payment_session_id || !attempt) return { status: 404, body: { code: "UNKNOWN_PAYU_TRANSACTION", message: "PayU transaction is not recognized" } }
  const session = await payment.retrievePaymentSession(mapping.payment_session_id)
  const sessionData = session.data as Record<string, unknown> | undefined
  const sessionFields = sessionData?.fields as Record<string, unknown> | undefined
  const sessionCartId = sessionData?.cart_id ?? sessionFields?.udf1
  const cartId = attempt.cart_id
  if (!cartId || (sessionCartId !== undefined && String(sessionCartId) !== cartId) || (fields.udf1 !== undefined && String(fields.udf1) !== cartId)) return { status: 400, body: { code: "PAYU_CART_MISMATCH", message: "PayU transaction is not associated with this cart" } }
  const cart = await req.scope.resolve<any>(Modules.CART).retrieveCart(cartId)
  const amountPaise = parseRupeesToPaise(fields.amount)
  if (amountPaise === null || amountPaise !== medusaAmountToPaise(session.amount, "Payment session amount") || amountPaise !== Number(attempt.expected_amount_paise)) return { status: 400, body: { code: "PAYU_AMOUNT_MISMATCH", message: "PayU amount does not match the authoritative payment session" } }
  const payloadHash = createHash("sha256").update(JSON.stringify(fields)).digest("hex")
  let medusaPaymentId: string | undefined
  try {
    const collection = await (payment as any).retrievePaymentCollection(session.payment_collection_id, { relations: ["payments"] })
    medusaPaymentId = collection?.payments?.find((candidate: { provider_id?: string }) => candidate.provider_id === "pp_payu")?.id
  } catch { /* The payment record can be materialized after the first callback. */ }
  const recorded = await service.recordPaymentEvent({ providerEventId: paymentEventFingerprint(`payu-${source}`, fields), providerTransactionId: transactionId, paymentId: medusaPaymentId ?? String(fields.mihpayid ?? transactionId), paymentSessionId: session.id, cartId, eventType: source, status: String(fields.status), amountPaise, eventPayloadHash: payloadHash })
  if (recorded.event.status === "completed") return { status: 200, body: { accepted: true, verified: true, duplicate: true, orderId: recorded.event.order_id } }
  const cartAttempt = (cart.metadata?.garmops_payment_attempt ?? {}) as Record<string, unknown>
  const disposition = paymentCallbackDisposition({ status: String(fields.status), attemptStatus: attempt.status, attemptRevisionHash: attempt.cart_revision_hash, currentCartRevisionHash: cartAttempt.status === "active" ? String(cartAttempt.cartRevisionHash ?? "") : undefined, expiresAt: attempt.expires_at })
  if (disposition !== "complete") {
    if (attempt.status === "active" && !paymentLockIsActive(attempt.expires_at)) await service.invalidatePaymentAttempt({ id: attempt.id, reason: "PayU callback arrived after payment lock expiry or cart revision change" })
    const status = disposition === "reconcile" ? "reconciliation_required" : "failed"
    await service.markPaymentEvent({ id: recorded.event.id, status, error: status === "reconciliation_required" ? "Payment captured for an invalidated or changed cart revision" : "PayU callback arrived for an invalidated payment attempt" })
    return { status: status === "reconciliation_required" ? 202 : 409, body: { accepted: true, verified: true, recoverable: status === "reconciliation_required", code: "PAYU_ATTEMPT_INVALIDATED", message: "PayU transaction cannot complete the current cart revision" } }
  }
  const providerStatus = String(fields.status).toLowerCase()
  if (providerStatus !== "success") {
    await payment.updatePaymentSession({ id: session.id, amount: session.amount, currency_code: session.currency_code, status: ["failure", "failed", "cancelled", "canceled"].includes(providerStatus) ? "canceled" : "error", data: { ...(session.data ?? {}), provider_status: providerStatus, verified: false } })
    await service.markPaymentEvent({ id: recorded.event.id, status: providerStatus })
    await req.scope.resolve<any>(Modules.CART).updateCarts(cartId, { metadata: { ...(cart.metadata ?? {}), garmops_payment_attempt: { ...cartAttempt, status: "failed", resolvedAt: new Date().toISOString() } } })
    await service.updatePaymentAttempts({ id: attempt.id, status: "failed", last_error: `PayU status: ${providerStatus}` })
    return { status: 200, body: { accepted: true, verified: true, paymentStatus: providerStatus } }
  }
  await payment.updatePaymentSession({ id: session.id, amount: session.amount, currency_code: session.currency_code, data: { ...(session.data ?? {}), provider_status: "success", verified: true, verified_at: new Date().toISOString(), mihpayid: String(fields.mihpayid ?? transactionId) } })
  try {
    const completed = await completeVerifiedPayuPayment(req.scope, { cartId, providerTransactionId: transactionId, paymentId: String(fields.mihpayid ?? transactionId) })
    try {
      const collection = await (payment as any).retrievePaymentCollection(session.payment_collection_id, { relations: ["payments"] })
      const materializedPaymentId = collection?.payments?.find((candidate: { provider_id?: string }) => candidate.provider_id === "pp_payu")?.id
      if (materializedPaymentId && materializedPaymentId !== recorded.event.payment_id) await service.updatePaymentEvents({ id: recorded.event.id, payment_id: materializedPaymentId })
    } catch { /* The order is complete even if payment-event enrichment is retried later. */ }
    await service.markPaymentEvent({ id: recorded.event.id, status: "completed", orderId: completed.order.id })
    await service.updatePaymentAttempts({ id: attempt.id, status: "completed", completed_at: new Date() })
    return { status: 200, body: { accepted: true, verified: true, duplicate: recorded.duplicate, orderId: completed.order.id, orderNumber: completed.orderNumber } }
  } catch (error) {
    await service.schedulePaymentReconciliationRetry({ id: recorded.event.id, error: error instanceof Error ? error.message : "Order completion is pending retry", maxRetries: Number(process.env.PAYU_RECONCILIATION_MAX_RETRIES || 5) })
    return { status: 202, body: { accepted: true, verified: true, recoverable: true, message: "Payment verified; order completion is queued for retry" } }
  }
}
