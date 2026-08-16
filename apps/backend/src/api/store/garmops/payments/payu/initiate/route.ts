import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { MedusaError } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import { assertCheckoutReadyForPayment } from "../../../../../../services/garmops-cart"
import { initiatePayuPaymentWorkflow } from "../../../../../../workflows/initiate-payu-payment"
import type GarmopsModuleService from "../../../../../../modules/garmops/service"
import { GARMOPS_MODULE } from "../../../../../../modules/garmops"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../../../../../../domain/legal"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const cartId = String((req.body as Record<string, unknown>).cartId ?? "")
  const actorId = req.auth_context?.actor_id
  if (!cartId || !actorId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)
  try {
    return await locking.execute(`payu-init:${cartId}`, async () => {
      const ready = await assertCheckoutReadyForPayment(req.scope, cartId, actorId)
      const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
      const cart = ready.cart
      const existingAttempt = asRecord(cart.metadata?.garmops_payment_attempt)
      if (existingAttempt.status === "active" && Date.parse(String(existingAttempt.expiresAt ?? "")) > Date.now()) {
        const sessionId = String(existingAttempt.paymentSessionId ?? "")
        if (!sessionId) throw new MedusaError(MedusaError.Types.CONFLICT, "A payment attempt is already active for this cart")
        const existingSession = await req.scope.resolve<any>(Modules.PAYMENT).retrievePaymentSession(sessionId)
        return res.status(201).json({ paymentCollectionId: existingSession.payment_collection_id, paymentSession: existingSession, amountPaise: Number(existingAttempt.expectedAmountPaise), requestId: req.requestId })
      }
      if (existingAttempt.status === "active") {
        if (typeof existingAttempt.id === "string") await service.invalidatePaymentAttempt({ id: existingAttempt.id, reason: "Payment lock expired before a new attempt was initiated" })
        await req.scope.resolve<any>(Modules.CART).updateCarts(cartId, { metadata: { ...(cart.metadata ?? {}), garmops_payment_attempt: { ...existingAttempt, status: "invalidated", invalidatedAt: new Date().toISOString() } } })
      }
      const { result } = await initiatePayuPaymentWorkflow(req.scope).run({ input: { cartId, customerId: actorId, amountPaise: ready.authoritativeTotal, data: { cart_id: cartId, cart_type: ready.profile.cart_type, productinfo: `Garmops ${ready.profile.cart_type} order`, email: cart.email ?? "", phone: ready.phone } } })
      const session = (Array.isArray(result.session) ? result.session[0] : result.session) as Record<string, unknown>
      const sessionData = (session?.data ?? {}) as Record<string, unknown>
      const sessionFields = (sessionData.fields ?? {}) as Record<string, unknown>
      const providerTransactionId = String(sessionData.txnid ?? sessionFields.txnid ?? "")
      if (!providerTransactionId || !session?.id) throw new MedusaError(MedusaError.Types.CONFLICT, "PayU did not return a payment transaction")
      const snapshot = { cartId, cartType: ready.profile.cart_type, amountPaise: ready.authoritativeTotal, cartRevisionHash: ready.cartRevisionHash, configuredLines: ready.lines.map((line) => ({ id: line.id, lineItemId: line.line_item_id, projectId: line.project_id, versionId: line.version_id, productSlug: line.product_slug, quantity: line.quantity, sizes: line.size_breakdown, pricing: line.pricing_snapshot })), sampleItems: (cart.items ?? []).map((item) => ({ id: item.id, quantity: item.quantity, metadata: item.metadata })), checkout: cart.metadata?.garmops_checkout ?? null, legal: { acceptanceId: ready.acceptance.id, termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION } }
      const revisionHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")
      const expiresAt = new Date(Date.now() + 30 * 60_000)
      try {
        const attempt = await service.createPaymentAttempts({ provider: "payu", cart_id: cartId, customer_id: actorId, payment_session_id: String(session.id), provider_transaction_id: providerTransactionId, expected_amount_paise: ready.authoritativeTotal, cart_revision_hash: revisionHash, snapshot, status: "active", expires_at: expiresAt, invalidated_at: null, completed_at: null, last_error: null })
        const eventPayloadHash = createHash("sha256").update(JSON.stringify({ providerTransactionId, paymentSessionId: String(session.id), amountPaise: ready.authoritativeTotal, source: "initiation" })).digest("hex")
        await service.recordPaymentEvent({ providerEventId: `payu-init-${providerTransactionId}`, providerTransactionId, paymentSessionId: String(session.id), cartId, eventType: "initiated", status: "initiated", amountPaise: ready.authoritativeTotal, eventPayloadHash })
        await req.scope.resolve<any>(Modules.CART).updateCarts(cartId, { metadata: { ...(cart.metadata ?? {}), garmops_payment_attempt: { id: attempt.id, providerTransactionId, paymentSessionId: String(session.id), cartId, customerId: actorId, expectedAmountPaise: ready.authoritativeTotal, revisionHash, cartRevisionHash: revisionHash, status: "active", expiresAt: expiresAt.toISOString() } } })
        return res.status(201).json({ paymentCollectionId: result.collectionId, paymentSession: result.session, amountPaise: ready.authoritativeTotal, requestId: req.requestId })
      } catch (error) {
        try { await req.scope.resolve<any>(Modules.PAYMENT).updatePaymentSession({ id: String(session.id), amount: session.amount, currency_code: session.currency_code, status: "canceled", data: { ...(session.data as Record<string, unknown> ?? {}), provider_status: "persistence_failed" } }) } catch { /* the session is still recoverable through the payment collection */ }
        throw error
      }
    }, { timeout: 30 })
  } catch (error) {
    return res.status(400).json({ code: "PAYMENT_INITIATION_FAILED", message: error instanceof Error ? error.message : "Payment could not be initiated", requestId: req.requestId })
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
