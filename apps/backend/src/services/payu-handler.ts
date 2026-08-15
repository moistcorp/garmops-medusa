import type { MedusaRequest } from "@medusajs/framework/http"
import type { IPaymentModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { completeVerifiedPayuPayment } from "./order-completion"
import { parseRupeesToPaise, paymentEventFingerprint, verifyPaymentResponseHash, type PayuFields } from "../providers/payu/security"

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
  if (!mapping?.payment_session_id) return { status: 404, body: { code: "UNKNOWN_PAYU_TRANSACTION", message: "PayU transaction is not recognized" } }
  const session = await payment.retrievePaymentSession(mapping.payment_session_id)
  const sessionData = session.data as Record<string, unknown> | undefined
  const sessionFields = sessionData?.fields as Record<string, unknown> | undefined
  const sessionCartId = sessionData?.cart_id ?? sessionFields?.udf1
  const cartId = String(fields.udf1 ?? sessionCartId ?? "")
  if (!cartId || (sessionCartId !== undefined && String(sessionCartId) !== cartId)) return { status: 400, body: { code: "PAYU_CART_MISMATCH", message: "PayU transaction is not associated with this cart" } }
  const cart = await req.scope.resolve<any>(Modules.CART).retrieveCart(cartId)
  const attempt = (cart.metadata?.garmops_payment_attempt ?? {}) as Record<string, unknown>
  if (attempt.providerTransactionId !== transactionId || attempt.status !== "active" || attempt.revisionHash !== mapping.payload_hash) return { status: 409, body: { code: "PAYU_CART_REVISION_MISMATCH", message: "PayU transaction does not match the active cart revision" } }
  const amountPaise = parseRupeesToPaise(fields.amount)
  if (amountPaise === null || amountPaise !== Number(session.amount)) return { status: 400, body: { code: "PAYU_AMOUNT_MISMATCH", message: "PayU amount does not match the authoritative payment session" } }
  const payloadHash = createHash("sha256").update(JSON.stringify(fields)).digest("hex")
  const recorded = await service.recordPaymentEvent({ providerEventId: paymentEventFingerprint(`payu-${source}`, fields), providerTransactionId: transactionId, paymentId: String(fields.mihpayid ?? transactionId), paymentSessionId: session.id, cartId, eventType: source, status: String(fields.status), amountPaise, payloadHash })
  if (recorded.event.status === "completed") return { status: 200, body: { accepted: true, verified: true, duplicate: true, orderId: recorded.event.order_id } }
  const providerStatus = String(fields.status).toLowerCase()
  if (providerStatus !== "success") {
    await payment.updatePaymentSession({ id: session.id, amount: session.amount, currency_code: session.currency_code, status: ["failure", "failed", "cancelled", "canceled"].includes(providerStatus) ? "canceled" : "error", data: { ...(session.data ?? {}), provider_status: providerStatus, verified: false } })
    await service.markPaymentEvent({ id: recorded.event.id, status: providerStatus })
    await req.scope.resolve<any>(Modules.CART).updateCarts(cartId, { metadata: { ...(cart.metadata ?? {}), garmops_payment_attempt: { ...attempt, status: "failed", resolvedAt: new Date().toISOString() } } })
    return { status: 200, body: { accepted: true, verified: true, paymentStatus: providerStatus } }
  }
  await payment.updatePaymentSession({ id: session.id, amount: session.amount, currency_code: session.currency_code, data: { ...(session.data ?? {}), provider_status: "success", verified: true, verified_at: new Date().toISOString(), mihpayid: String(fields.mihpayid ?? transactionId) } })
  try {
    const completed = await completeVerifiedPayuPayment(req.scope, { cartId, providerTransactionId: transactionId, paymentId: String(fields.mihpayid ?? transactionId) })
    await service.markPaymentEvent({ id: recorded.event.id, status: "completed", orderId: completed.order.id })
    return { status: 200, body: { accepted: true, verified: true, duplicate: recorded.duplicate, orderId: completed.order.id, orderNumber: completed.orderNumber } }
  } catch (error) {
    await service.markPaymentEvent({ id: recorded.event.id, status: "artifact_pending", error: error instanceof Error ? error.message : "Order completion is pending retry" })
    return { status: 202, body: { accepted: true, verified: true, recoverable: true, message: "Payment verified; order completion is queued for retry" } }
  }
}
