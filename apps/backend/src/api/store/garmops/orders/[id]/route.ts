import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { customerOrderView, findOwnedOrder } from "../../../../../services/customer-orders"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  try { return res.json({ order: await customerOrderView(req.scope, await findOwnedOrder(req.scope, req.params.id, customerId)), requestId: req.requestId }) } catch (error) { return res.status(404).json({ code: "ORDER_NOT_FOUND", message: error instanceof Error ? error.message : "Order not found", requestId: req.requestId }) }
}
