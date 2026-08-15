import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { removeConfiguredLine, summarizeCart, updateConfiguredLine } from "../../../../../services/garmops-cart"

export async function PATCH(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { versionId?: string; quantity?: number; sizes?: Record<string, number>; sizeBreakdown?: Record<string, number>; deliveryType?: string; configuration?: Record<string, unknown> }
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  try {
    const result = await updateConfiguredLine(req.scope, { ...body, lineId: req.params.id, customerId })
    return res.json({ line: result.line, pricing: result.pricing, cart: await summarizeCart(req.scope, result.cart.id, customerId), requestId: req.requestId })
  } catch (error) {
    return res.status(400).json({ code: "INVALID_CONFIGURED_LINE", message: error instanceof Error ? error.message : "Configured line is invalid", requestId: req.requestId })
  }
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  try {
    await removeConfiguredLine(req.scope, req.params.id, customerId)
    return res.status(204).send()
  } catch (error) {
    return res.status(404).json({ code: "LINE_NOT_FOUND", message: error instanceof Error ? error.message : "Line not found", requestId: req.requestId })
  }
}
