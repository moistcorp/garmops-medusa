import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../modules/garmops/service"
import { hasStaffPermission } from "../../../../../auth/staff"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { status?: string; reason?: string }
  const target = body.status as Parameters<GarmopsModuleService["transitionProduction"]>[0]["target"]
  const actorId = req.auth_context?.actor_id
  if (!actorId) return res.status(403).json({ code: "FORBIDDEN", message: "Staff permission required", requestId: req.requestId })
  try {
    if (["cancelled", "refund_pending", "refunded", "artwork_approved"].includes(String(body.status))) return res.status(403).json({ code: "DEDICATED_WORKFLOW_REQUIRED", message: "This state can only be changed through its dedicated workflow", requestId: req.requestId })
    const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
    if (!(await hasStaffPermission(req, service, "change_order_status"))) return res.status(403).json({ code: "FORBIDDEN", message: "Active staff role required", requestId: req.requestId })
    const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)
    const job = await locking.execute(`production-job:${req.params.id}`, () => service.transitionProduction({ jobId: req.params.id, target, actorId, requestId: req.requestId, reason: body.reason }), { timeout: 30 })
    res.json({ job, requestId: req.requestId })
  } catch (error) { res.status(409).json({ code: "INVALID_TRANSITION", message: error instanceof Error ? error.message : "Invalid production transition", requestId: req.requestId }) }
}
