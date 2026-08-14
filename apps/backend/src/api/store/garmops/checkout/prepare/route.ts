import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveCheckout, summarizeCart } from "../../../../../services/garmops-cart"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { cartId?: string; email?: string; projectName?: string; orderNotes?: string; gstin?: string; billingEntity?: string; shippingAddress?: unknown; billingAddress?: unknown; termsVersion?: string; privacyVersion?: string; requestedDeliveryDate?: string; deliveryPreference?: string }
  const customerId = req.auth_context?.actor_id
  if (!customerId || !body.cartId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication and cartId are required", requestId: req.requestId })
  if (!body.email || !body.shippingAddress || !body.termsVersion) return res.status(400).json({ code: "CHECKOUT_DATA_REQUIRED", message: "Email, shipping address, and current terms acceptance are required", requestId: req.requestId })
  try {
    await saveCheckout(req.scope, { ...body, email: body.email, termsVersion: body.termsVersion, shippingAddress: body.shippingAddress, cartId: body.cartId, customerId, requestId: req.requestId })
    const summary = await summarizeCart(req.scope, body.cartId, customerId)
    if (summary.validationProblems.length) return res.status(409).json({ code: "CHECKOUT_INVALID", message: summary.validationProblems[0], problems: summary.validationProblems, requestId: req.requestId })
    return res.json({ checkout: { cartId: body.cartId, amountPaise: summary.grandTotalPaise, readyForPayment: true }, cart: summary, requestId: req.requestId })
  } catch (error) { return res.status(400).json({ code: "CHECKOUT_INVALID", message: error instanceof Error ? error.message : "Checkout data is invalid", requestId: req.requestId }) }
}
