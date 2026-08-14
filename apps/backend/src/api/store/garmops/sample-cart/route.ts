import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addSampleLine, createCustomerCart, summarizeCart } from "../../../../services/garmops-cart"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  const cartId = typeof req.query.cartId === "string" ? req.query.cartId : ""
  if (!customerId || !cartId) return res.status(400).json({ code: "CART_ID_REQUIRED", message: "cartId is required", requestId: req.requestId })
  try { return res.json({ cart: await summarizeCart(req.scope, cartId, customerId), requestId: req.requestId }) } catch (error) { return res.status(404).json({ code: "CART_NOT_FOUND", message: error instanceof Error ? error.message : "Cart not found", requestId: req.requestId }) }
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  const body = req.body as { cartId?: string; productSlug?: string; size?: string; quantity?: number; email?: string }
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  try {
    const cart = body.cartId ? { cart: { id: body.cartId } } : await createCustomerCart(req.scope, customerId, "sample", body.email)
    const quantity = body.quantity
    if (!body.productSlug || !body.size || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) return res.status(400).json({ code: "INVALID_SAMPLE_LINE", message: "productSlug, size, and positive quantity are required", requestId: req.requestId })
    const result = await addSampleLine(req.scope, { cartId: cart.cart.id, customerId, productSlug: body.productSlug, size: body.size, quantity: quantity as number })
    return res.status(201).json({ item: result.item, pricing: result.pricing, cart: await summarizeCart(req.scope, cart.cart.id, customerId), requestId: req.requestId })
  } catch (error) { return res.status(400).json({ code: "INVALID_SAMPLE_LINE", message: error instanceof Error ? error.message : "Sample line is invalid", requestId: req.requestId }) }
}
