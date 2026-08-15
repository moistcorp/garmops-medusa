import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../modules/garmops/service"
import { hasStaffPermission } from "../../../../../auth/staff"
import { setGarmopsTrackingWorkflow } from "../../../../../workflows/garmops-mutations"
import { MedusaError } from "@medusajs/framework/utils"

export async function PATCH(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "change_order_status"))) return res.status(403).json({ code: "FORBIDDEN", message: "Active staff role required", requestId: req.requestId })
  const body = req.body as { trackingNumber?: string; trackingUrl?: string }
  const trackingNumber = body.trackingNumber?.trim()
  const trackingUrl = body.trackingUrl?.trim() || null
  if (!trackingNumber || trackingNumber.length > 200) return res.status(400).json({ code: "INVALID_TRACKING", message: "A tracking number is required", requestId: req.requestId })
  if (trackingUrl) {
    try {
      const parsed = new URL(trackingUrl)
      if (parsed.protocol !== "https:") throw new MedusaError(MedusaError.Types.INVALID_DATA, "Tracking URL must use HTTPS")
    } catch {
      return res.status(400).json({ code: "INVALID_TRACKING", message: "Tracking URL must be a valid HTTPS URL", requestId: req.requestId })
    }
  }
  try {
    const { result: job } = await setGarmopsTrackingWorkflow(req.scope).run({ input: { jobId: req.params.id, trackingNumber, trackingUrl, actorId: req.auth_context?.actor_id ?? "", requestId: req.requestId } })
    return res.json({ job, requestId: req.requestId })
  } catch (error) {
    return res.status(404).json({ code: "ORDER_NOT_FOUND", message: error instanceof Error ? error.message : "Order not found", requestId: req.requestId })
  }
}
