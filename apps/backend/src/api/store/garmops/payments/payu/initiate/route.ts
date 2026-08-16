import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ICartModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { MedusaError } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import { GARMOPS_MODULE } from "../../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../../modules/garmops/service"
import { findCatalogProduct } from "../../../../../../domain/catalog"
import { priceConfiguredLine, samplePrice, validateConfiguredLine } from "../../../../../../domain/pricing"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../../../../../../domain/legal"
import { extraLeadTimeForConfiguration, validateDeliveryDate } from "../../../../../../domain/delivery"
import { getCartRevisionHash } from "../../../../../../services/garmops-cart"
import { initiatePayuPaymentWorkflow } from "../../../../../../workflows/initiate-payu-payment"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const cartId = String((req.body as Record<string, unknown>).cartId ?? "")
  const actorId = req.auth_context?.actor_id
  if (!cartId || !actorId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  try {
    const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)
    const cart = await cartService.retrieveCart(cartId, { relations: ["items", "billing_address", "shipping_address"] })
    if (cart.customer_id !== actorId) return res.status(404).json({ code: "CART_NOT_FOUND", message: "Cart not found", requestId: req.requestId })
    const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
    const profile = (await service.listCartProfiles({ cart_id: cartId }))[0]
    if (!profile || profile.customer_id !== actorId) return res.status(409).json({ code: "CART_PROFILE_INVALID", message: "Cart ownership or type is invalid", requestId: req.requestId })
    const existingAttempt = asRecord(cart.metadata?.garmops_payment_attempt)
    if (existingAttempt.status === "active" && Date.parse(String(existingAttempt.expiresAt ?? "")) > Date.now()) {
      const sessionId = String(existingAttempt.paymentSessionId ?? "")
      if (!sessionId) return res.status(409).json({ code: "PAYMENT_ATTEMPT_ACTIVE", message: "A payment attempt is already active for this cart", requestId: req.requestId })
      const existingSession = await req.scope.resolve<any>(Modules.PAYMENT).retrievePaymentSession(sessionId)
      return res.status(201).json({ paymentCollectionId: existingSession.payment_collection_id, paymentSession: existingSession, amountPaise: Number(existingAttempt.expectedAmountPaise), requestId: req.requestId })
    }
    if (existingAttempt.status === "active") {
      const existingAttemptId = existingAttempt.id
      if (typeof existingAttemptId === "string") await service.invalidatePaymentAttempt({ id: existingAttemptId, reason: "Payment lock expired before a new attempt was initiated" })
      await cartService.updateCarts(cartId, { metadata: { ...(cart.metadata ?? {}), garmops_payment_attempt: { ...existingAttempt, status: "invalidated", invalidatedAt: new Date().toISOString() } } })
    }
    const lines = await service.listConfiguredCartLines({ cart_id: cartId })
    const checkout = asRecord(cart.metadata?.garmops_checkout)
    const configuredExtraLeadTime = await extraLeadTimeForLines(req.scope, lines, service)
    validateDeliveryDate({ deliveryType: typeof checkout.deliveryPreference === "string" ? checkout.deliveryPreference : undefined, requestedDeliveryDate: typeof checkout.requestedDeliveryDate === "string" ? checkout.requestedDeliveryDate : undefined, extraLeadTimeDays: configuredExtraLeadTime })
    const cartRevisionHash = await getCartRevisionHash(req.scope, cartId)
    const acceptance = (await service.listTermsAcceptances({ cart_id: cartId, customer_id: actorId, cart_revision_hash: cartRevisionHash, terms_version: CURRENT_TERMS_VERSION, privacy_version: CURRENT_PRIVACY_VERSION }, { order: { accepted_at: "DESC" }, take: 1 }))[0]
    if (!acceptance) throw new MedusaError(MedusaError.Types.CONFLICT, "Current Terms and Privacy acceptance is required for this cart revision")
    let authoritativeTotal = 0
    if (profile.cart_type === "configured") {
      if (!lines.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Configured cart has no configured lines")
      for (const line of lines) {
        const version = await service.retrieveDesignVersion(line.version_id)
        const configuration = version.configuration as Record<string, unknown>
        validateDeliveryDate({ deliveryType: line.delivery_type, requestedDeliveryDate: typeof checkout.requestedDeliveryDate === "string" ? checkout.requestedDeliveryDate : undefined, extraLeadTimeDays: extraLeadTimeForConfiguration(configuration) })
        const sizes = line.size_breakdown as Record<string, number>
        validateConfiguredLine({ productSlug: line.product_slug, quantity: line.quantity, sizes, allowedSizes: findCatalogProduct(line.product_slug)?.sizes ?? [], colourType: configuration.colourType as "signature" | "custom_dye" | undefined, artwork: configuration.artwork as never, neckLabel: configuration.neckLabel as never, deliveryType: line.delivery_type as "rush" | "standard" | "flexible" })
        for (const fileId of referencedFileIds(configuration)) {
          const file = await service.retrieveStoredFile(fileId)
          if (file.customer_id !== actorId || file.state !== "finalized" || file.scan_status !== "clean") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "All artwork must be verified and malware-clean before payment")
        }
        authoritativeTotal += priceConfiguredLine({ productSlug: line.product_slug, quantity: line.quantity, colourType: configuration.colourType as "signature" | "custom_dye" | undefined, artwork: configuration.artwork as never, neckLabel: configuration.neckLabel as never, deliveryType: line.delivery_type as "rush" | "standard" | "flexible" }).totalPaise
      }
    } else {
      if (lines.length) throw new MedusaError(MedusaError.Types.CONFLICT, "Configured lines cannot be paid from a sample cart")
      for (const item of cart.items ?? []) authoritativeTotal += samplePrice(String(item.metadata?.garmops_sample_product_slug ?? ""), String(item.metadata?.garmops_sample_size ?? ""), Number(item.quantity)).totalPaise
    }
    if (Number(cart.total) !== authoritativeTotal) throw new MedusaError(MedusaError.Types.CONFLICT, "Cart total is stale; refresh the cart before payment")
    const { result } = await initiatePayuPaymentWorkflow(req.scope).run({ input: { cartId, customerId: actorId, amountPaise: authoritativeTotal, data: { cart_id: cartId, cart_type: profile.cart_type, productinfo: `Garmops ${profile.cart_type} order`, email: cart.email ?? "" } } })
    const session = (Array.isArray(result.session) ? result.session[0] : result.session) as Record<string, unknown>
    const sessionData = (session?.data ?? {}) as Record<string, unknown>
    const sessionFields = (sessionData.fields ?? {}) as Record<string, unknown>
    const providerTransactionId = String(sessionData.txnid ?? sessionFields.txnid ?? "")
    if (!providerTransactionId || !session?.id) throw new MedusaError(MedusaError.Types.CONFLICT, "PayU did not return a payment transaction")
    const snapshot = { cartId, cartType: profile.cart_type, amountPaise: authoritativeTotal, cartRevisionHash, configuredLines: lines.map((line) => ({ id: line.id, lineItemId: line.line_item_id, projectId: line.project_id, versionId: line.version_id, productSlug: line.product_slug, quantity: line.quantity, sizes: line.size_breakdown, pricing: line.pricing_snapshot })), sampleItems: (cart.items ?? []).map((item) => ({ id: item.id, quantity: item.quantity, metadata: item.metadata })), checkout: cart.metadata?.garmops_checkout ?? null, legal: { acceptanceId: acceptance.id, termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION } }
    const revisionHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")
    const expiresAt = new Date(Date.now() + 30 * 60_000)
    const attempt = await service.createPaymentAttempts({ provider: "payu", cart_id: cartId, customer_id: actorId, payment_session_id: String(session.id), provider_transaction_id: providerTransactionId, expected_amount_paise: authoritativeTotal, cart_revision_hash: revisionHash, snapshot, status: "active", expires_at: expiresAt, invalidated_at: null, completed_at: null, last_error: null })
    const eventPayloadHash = createHash("sha256").update(JSON.stringify({ providerTransactionId, paymentSessionId: String(session.id), amountPaise: authoritativeTotal, source: "initiation" })).digest("hex")
    await service.recordPaymentEvent({ providerEventId: `payu-init-${providerTransactionId}`, providerTransactionId, paymentSessionId: String(session.id), cartId, eventType: "initiated", status: "initiated", amountPaise: authoritativeTotal, eventPayloadHash })
    await cartService.updateCarts(cartId, { metadata: { ...(cart.metadata ?? {}), garmops_payment_attempt: { id: attempt.id, providerTransactionId, paymentSessionId: String(session.id), cartId, customerId: actorId, expectedAmountPaise: authoritativeTotal, revisionHash, cartRevisionHash: revisionHash, status: "active", expiresAt: expiresAt.toISOString() } } })
    res.status(201).json({ paymentCollectionId: result.collectionId, paymentSession: result.session, amountPaise: authoritativeTotal, requestId: req.requestId })
  } catch (error) {
    res.status(400).json({ code: "PAYMENT_INITIATION_FAILED", message: error instanceof Error ? error.message : "Payment could not be initiated", requestId: req.requestId })
  }
}

async function extraLeadTimeForLines(_scope: Pick<MedusaContainer, "resolve">, lines: Array<{ version_id: string }>, service: GarmopsModuleService): Promise<number> {
  for (const line of lines) {
    const version = await service.retrieveDesignVersion(line.version_id)
    const extra = extraLeadTimeForConfiguration(version.configuration)
    if (extra > 0) return extra
  }
  return 0
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function referencedFileIds(configuration: Record<string, unknown>): string[] {
  const values: unknown[] = [
    (configuration.artwork as Record<string, unknown> | undefined)?.front,
    (configuration.artwork as Record<string, unknown> | undefined)?.back,
    configuration.neckLabel,
  ]
  return values.map((value) => typeof value === "object" && value !== null ? (value as Record<string, unknown>).fileId : undefined).filter((value): value is string => typeof value === "string")
}
