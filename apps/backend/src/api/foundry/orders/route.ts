import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../modules/garmops"
import type GarmopsModuleService from "../../../modules/garmops/service"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const [jobs, count] = await service.listAndCountProductionJobs({}, { take: 100, skip: 0, order: { created_at: "DESC" } })
  res.json({ orders: jobs, count, requestId: req.requestId })
}
