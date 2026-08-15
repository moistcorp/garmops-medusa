import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveCheckoutDetails, summarizeCart } from "../../../../../services/garmops-cart"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { cartId?: string; email?: string; shippingAddress?: unknown; billingAddress?: unknown; gstin?: string; billingEntity?: string; requestedDeliveryDate?: string; deliveryPreference?: string }
  const customerId = req.auth_context?.actor_id
  if (!customerId || !body.cartId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication and cartId are required", requestId: req.requestId })
  if (!body.email || !body.shippingAddress) return res.status(400).json({ code: "CHECKOUT_DATA_REQUIRED", message: "Email and shipping address are required", requestId: req.requestId })
  try {
    await saveCheckoutDetails(req.scope, { ...body, cartId: body.cartId, customerId, email: body.email, shippingAddress: body.shippingAddress })
    return res.json({ cart: await summarizeCart(req.scope, body.cartId, customerId), requestId: req.requestId })
  } catch (error) {
    return res.status(400).json({ code: "CHECKOUT_INVALID", message: error instanceof Error ? error.message : "Checkout details are invalid", requestId: req.requestId })
  }
}
