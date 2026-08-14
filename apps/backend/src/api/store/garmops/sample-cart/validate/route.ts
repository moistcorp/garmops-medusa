import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { summarizeCart } from "../../../../../services/garmops-cart"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  const cartId = String((req.body as { cartId?: string }).cartId ?? "")
  if (!customerId || !cartId) return res.status(400).json({ code: "CART_ID_REQUIRED", message: "cartId is required", requestId: req.requestId })
  try {
    const cart = await summarizeCart(req.scope, cartId, customerId)
    if (cart.cartType !== "sample") return res.status(409).json({ code: "CART_TYPE_MISMATCH", message: "Only sample carts can use sample validation", requestId: req.requestId })
    return res.json({ valid: cart.validationProblems.length === 0, cart, problems: cart.validationProblems, requestId: req.requestId })
  } catch (error) { return res.status(400).json({ code: "SAMPLE_CART_INVALID", message: error instanceof Error ? error.message : "Sample cart is invalid", requestId: req.requestId }) }
}
