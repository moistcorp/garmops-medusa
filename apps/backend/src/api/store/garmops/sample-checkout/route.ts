import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import { addSampleLine, createCustomerCart, normalizeCustomerPhone, saveCheckout, summarizeCart } from "../../../../services/garmops-cart"
import { GARMOPS_MODULE } from "../../../../modules/garmops"
import type GarmopsModuleService from "../../../../modules/garmops/service"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../../../../domain/legal"

type SampleCheckoutBody = {
  items?: Array<{ productSlug?: string; size?: string; quantity?: number }>
  contact?: { firstName?: string; lastName?: string; email?: string; phone?: string }
  shipping?: { address?: Record<string, unknown> }
  orderNotes?: string
  acceptedTerms?: boolean
  idempotencyKey?: string
}

function fingerprint(body: SampleCheckoutBody): string {
  const normalized = {
    items: (body.items ?? []).map((item) => ({ productSlug: item.productSlug, size: item.size, quantity: item.quantity })).sort((a, b) => `${a.productSlug}:${a.size}`.localeCompare(`${b.productSlug}:${b.size}`)),
    contact: body.contact,
    shipping: body.shipping,
    orderNotes: body.orderNotes,
    acceptedTerms: body.acceptedTerms,
  }
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex")
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as SampleCheckoutBody
  const customerId = req.auth_context?.actor_id
  const contact = body.contact ?? {}
  const key = String(body.idempotencyKey ?? "").trim()
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  if (!key || key.length > 200 || !body.acceptedTerms || typeof contact.email !== "string" || typeof contact.firstName !== "string" || typeof contact.phone !== "string" || !body.shipping?.address || !Array.isArray(body.items) || body.items.length === 0) return res.status(400).json({ code: "INVALID_SAMPLE_CHECKOUT", message: "Complete sample checkout details and a unique idempotency key are required", requestId: req.requestId })
  if (!normalizeCustomerPhone(contact.phone)) return res.status(400).json({ code: "INVALID_SAMPLE_PHONE", message: "A valid 10-digit Indian mobile number is required", requestId: req.requestId })
  const items = body.items
  const email = contact.email
  const firstName = contact.firstName
  const phone = contact.phone
  const shippingAddress = body.shipping.address
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const storageKey = `${customerId}:${key}`
  const requestFingerprint = fingerprint(body)
  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)
  return locking.execute(`sample-checkout:${storageKey}`, async () => {
    const existing = (await service.listCheckoutIdempotencies({ key: storageKey }))[0]
    if (existing) {
      if (existing.customer_id !== customerId || existing.request_fingerprint !== requestFingerprint) return res.status(409).json({ code: "IDEMPOTENCY_CONFLICT", message: "This idempotency key was already used for a different request", requestId: req.requestId })
      const summary = await summarizeCart(req.scope, existing.cart_id, customerId)
      return res.status(200).json({ order: { checkoutPaymentAttemptId: existing.cart_id, alreadyFinalized: false, orderId: null, orderNumber: null, subtotalPaise: summary.subtotalPaise, taxPaise: summary.gstPaise, totalPaise: summary.grandTotalPaise }, requestId: req.requestId })
    }
    let createdCartId: string | null = null
    try {
    const { cart } = await createCustomerCart(req.scope, customerId, "sample", email)
    createdCartId = cart.id
    for (const item of items) {
      const quantity = item.quantity
      if (!item.productSlug || !item.size || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Each sample line needs a canonical product slug, size, and positive quantity")
      await addSampleLine(req.scope, { cartId: cart.id, customerId, productSlug: item.productSlug, size: item.size, quantity })
    }
    await saveCheckout(req.scope, { cartId: cart.id, customerId, email, orderNotes: body.orderNotes, shippingAddress: { ...shippingAddress, first_name: firstName, last_name: contact.lastName, phone, country_code: "in" }, billingAddress: { ...shippingAddress, first_name: firstName, last_name: contact.lastName, phone, country_code: "in" }, termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION, requestId: req.requestId })
    const summary = await summarizeCart(req.scope, cart.id, customerId)
    await service.createCheckoutIdempotencies({ key: storageKey, customer_id: customerId, request_fingerprint: requestFingerprint, cart_id: cart.id, status: "prepared", result: { subtotalPaise: summary.subtotalPaise, taxPaise: summary.gstPaise, totalPaise: summary.grandTotalPaise }, expires_at: new Date(Date.now() + 24 * 60 * 60_000) })
    return res.status(201).json({ order: { checkoutPaymentAttemptId: cart.id, alreadyFinalized: false, orderId: null, orderNumber: null, subtotalPaise: summary.subtotalPaise, taxPaise: summary.gstPaise, totalPaise: summary.grandTotalPaise }, requestId: req.requestId })
    } catch (error) {
      if (createdCartId) {
        try { await req.scope.resolve<any>(Modules.CART).deleteCarts(createdCartId) } catch { /* best-effort cleanup; the failed request remains retryable */ }
      }
      return res.status(409).json({ code: "INVALID_SAMPLE_CHECKOUT", message: error instanceof Error ? error.message : "The sample checkout could not be prepared", requestId: req.requestId })
    }
  }, { timeout: 120 })
}
