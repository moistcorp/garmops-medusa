import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { GARMOPS_MODULE } from "../../../../modules/garmops"
import type GarmopsModuleService from "../../../../modules/garmops/service"
import { hasStaffPermission } from "../../../../auth/staff"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "view_all_orders"))) return res.status(403).json({ code: "FORBIDDEN", message: "Active staff role required", requestId: req.requestId })
  try {
    const job = await service.retrieveProductionJob(req.params.id)
    const order = await req.scope.resolve<any>(Modules.ORDER).retrieveOrder(job.order_id, { relations: ["items", "billing_address", "shipping_address"] })
    const snapshots = await service.listOrderConfigurationSnapshots({ order_id: order.id }, { order: { line_number: "ASC" } })
    const invoice = (await service.listInvoices({ order_id: order.id }))[0]
    return res.json({ order, job, snapshots, invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoice_number, status: invoice.status } : null, requestId: req.requestId })
  } catch (error) { return res.status(404).json({ code: "ORDER_NOT_FOUND", message: error instanceof Error ? error.message : "Order not found", requestId: req.requestId }) }
}

