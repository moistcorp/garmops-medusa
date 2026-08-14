import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../modules/garmops/service"
import { hasStaffPermission } from "../../../../../auth/staff"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { status?: string; reason?: string }
  const target = body.status as Parameters<GarmopsModuleService["transitionProduction"]>[0]["target"]
  const actorId = req.auth_context?.actor_id
  if (!actorId) return res.status(403).json({ code: "FORBIDDEN", message: "Staff permission required", requestId: req.requestId })
  try {
    const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
    if (!(await hasStaffPermission(req, service, "change_order_status"))) return res.status(403).json({ code: "FORBIDDEN", message: "Active staff role required", requestId: req.requestId })
    const job = await service.transitionProduction({ jobId: req.params.id, target, actorId, requestId: req.requestId, reason: body.reason })
    res.json({ job, requestId: req.requestId })
  } catch (error) { res.status(409).json({ code: "INVALID_TRANSITION", message: error instanceof Error ? error.message : "Invalid production transition", requestId: req.requestId }) }
}
