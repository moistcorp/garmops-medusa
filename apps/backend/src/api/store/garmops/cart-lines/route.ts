import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addConfiguredLine, summarizeCart } from "../../../../services/garmops-cart"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { cartId?: string; projectId?: string; versionId?: string; quantity?: number; sizes?: Record<string, number>; sizeBreakdown?: Record<string, number>; deliveryType?: string; configuration?: Record<string, unknown> }
  const customerId = req.auth_context?.actor_id
  if (!customerId || !body.cartId || !body.projectId) return res.status(400).json({ code: "INVALID_CONFIGURED_LINE", message: "cartId and projectId are required", requestId: req.requestId })
  try {
    const result = await addConfiguredLine(req.scope, { ...body, customerId, cartId: body.cartId, projectId: body.projectId })
    return res.status(201).json({ line: result.line, pricing: result.pricing, cart: await summarizeCart(req.scope, body.cartId, customerId), requestId: req.requestId })
  } catch (error) {
    return res.status(400).json({ code: "INVALID_CONFIGURED_LINE", message: error instanceof Error ? error.message : "Configured line is invalid", requestId: req.requestId })
  }
}
