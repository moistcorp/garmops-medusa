import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { summarizeCart } from "../../../../../services/garmops-cart"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  try {
    return res.json({ cart: await summarizeCart(req.scope, req.params.id, customerId), requestId: req.requestId })
  } catch (error) {
    return res.status(404).json({ code: "CART_NOT_FOUND", message: error instanceof Error ? error.message : "Cart not found", requestId: req.requestId })
  }
}
