import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createCustomerCart, ownedCart, summarizeCart } from "../../../../services/garmops-cart"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  const cartId = typeof req.query.cartId === "string" ? req.query.cartId : ""
  const cartType = req.query.cartType === "sample" ? "sample" : "configured"
  if (!customerId || !cartId) return res.status(400).json({ code: "CART_ID_REQUIRED", message: "cartId is required", requestId: req.requestId })
  try {
    const result = await summarizeCart(req.scope, cartId, customerId)
    if (result.cartType !== cartType) return res.status(409).json({ code: "CART_TYPE_MISMATCH", message: "Cart type does not match the requested API", requestId: req.requestId })
    return res.json({ cart: result, requestId: req.requestId })
  } catch (error) {
    return res.status(404).json({ code: "CART_NOT_FOUND", message: error instanceof Error ? error.message : "Cart not found", requestId: req.requestId })
  }
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  const body = req.body as { cartId?: string; cartType?: "configured" | "sample"; email?: string }
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  if (body.cartId) {
    try {
      const result = await ownedCart(req.scope, body.cartId, customerId, body.cartType ?? "configured")
      return res.json({ cart: await summarizeCart(req.scope, result.cart.id, customerId), profile: result.profile, requestId: req.requestId })
    } catch (error) {
      return res.status(404).json({ code: "CART_NOT_FOUND", message: error instanceof Error ? error.message : "Cart not found", requestId: req.requestId })
    }
  }
  const cartType = body.cartType ?? "configured"
  if (cartType !== "configured" && cartType !== "sample") return res.status(400).json({ code: "INVALID_CART_TYPE", message: "cartType must be configured or sample", requestId: req.requestId })
  const result = await createCustomerCart(req.scope, customerId, cartType, body.email)
  return res.status(201).json({ cart: await summarizeCart(req.scope, result.cart.id, customerId), profile: result.profile, requestId: req.requestId })
}
