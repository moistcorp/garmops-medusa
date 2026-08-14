import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../modules/garmops"
import type GarmopsModuleService from "../../../modules/garmops/service"
import { hasStaffPermission } from "../../../auth/staff"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "view_all_orders"))) return res.status(403).json({ code: "FORBIDDEN", message: "Active staff role required", requestId: req.requestId })
  const [jobs, count] = await service.listAndCountProductionJobs({}, { take: 100, skip: 0, order: { created_at: "DESC" } })
  res.json({ orders: jobs, count, requestId: req.requestId })
}
