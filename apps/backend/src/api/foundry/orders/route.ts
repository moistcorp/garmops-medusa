import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../modules/garmops"
import type GarmopsModuleService from "../../../modules/garmops/service"
import { hasStaffPermission } from "../../../auth/staff"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "view_all_orders"))) return res.status(403).json({ code: "FORBIDDEN", message: "Active staff role required", requestId: req.requestId })
  const requestedLimit = Number(req.query.limit ?? 25)
  const limit = Number.isInteger(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 25
  const requestedOffset = Number(req.query.offset ?? 0)
  const offset = Number.isInteger(requestedOffset) ? Math.max(0, requestedOffset) : 0
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 80) : ""
  const filters = { ...(status ? { status } : {}), ...(search ? { order_number: { $ilike: `%${search}%` } } : {}) }
  const [jobs, count] = await service.listAndCountProductionJobs(filters as never, { take: limit, skip: offset, order: { created_at: "DESC" } })
  res.json({ orders: jobs, count, hasMore: offset + jobs.length < count, nextOffset: offset + jobs.length < count ? offset + jobs.length : null, requestId: req.requestId })
}
