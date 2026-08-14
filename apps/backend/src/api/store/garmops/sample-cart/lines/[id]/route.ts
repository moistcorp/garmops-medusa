import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { removeSampleLine, summarizeCart, updateSampleLine } from "../../../../../../services/garmops-cart"

export async function PATCH(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  const body = req.body as { productSlug?: string; size?: string; quantity?: number }
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  try { const result = await updateSampleLine(req.scope, { ...body, lineId: req.params.id, customerId }); return res.json({ item: result.item, pricing: result.pricing, cart: await summarizeCart(req.scope, result.cart.id, customerId), requestId: req.requestId }) } catch (error) { return res.status(400).json({ code: "INVALID_SAMPLE_LINE", message: error instanceof Error ? error.message : "Sample line is invalid", requestId: req.requestId }) }
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  try { await removeSampleLine(req.scope, req.params.id, customerId); return res.status(204).send() } catch (error) { return res.status(404).json({ code: "LINE_NOT_FOUND", message: error instanceof Error ? error.message : "Sample line not found", requestId: req.requestId }) }
}
