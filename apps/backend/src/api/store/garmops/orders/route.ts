import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { customerOrderView } from "../../../../services/customer-orders"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const [orders] = await orderService.listAndCountOrders({ customer_id: customerId }, { relations: ["items"], take: 100, order: { created_at: "DESC" } })
  const result = await Promise.all(orders.map((order) => customerOrderView(req.scope, order)))
  return res.json({ orders: result, count: result.length, requestId: req.requestId })
}
