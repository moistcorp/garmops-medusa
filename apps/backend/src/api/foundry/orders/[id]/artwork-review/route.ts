import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../modules/garmops/service"
import { hasStaffPermission } from "../../../../../auth/staff"
import { reviewGarmopsArtworkWorkflow } from "../../../../../workflows/garmops-mutations"
import { requiredArtworkFileIds } from "../../../../../domain/artwork"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "review_artwork"))) return res.status(403).json({ code: "FORBIDDEN", message: "Artwork review permission required", requestId: req.requestId })
  const body = req.body as { fileId?: string; decision?: "approve" | "reject" }
  if (!body.fileId || !body.decision || !["approve", "reject"].includes(body.decision)) return res.status(400).json({ code: "INVALID_ARTWORK_REVIEW", message: "fileId and approve/reject decision are required", requestId: req.requestId })
  try {
    const job = await service.retrieveProductionJob(req.params.id)
    const fileRecord = await service.retrieveStoredFile(body.fileId)
    const snapshots = await service.listOrderConfigurationSnapshots({ order_id: job.order_id })
    const targetBelongsToOrder = requiredArtworkFileIds(snapshots).includes(fileRecord.id)
    if (!targetBelongsToOrder) return res.status(404).json({ code: "ARTWORK_NOT_FOUND", message: "Artwork is not attached to this order", requestId: req.requestId })
    if (body.decision === "approve" && !["payment_confirmed", "order_review", "artwork_pending"].includes(job.status)) return res.status(409).json({ code: "ARTWORK_NOT_REVIEWABLE", message: "Artwork cannot be approved at the current production stage", requestId: req.requestId })
    const { result: file } = await reviewGarmopsArtworkWorkflow(req.scope).run({ input: { fileId: body.fileId, decision: body.decision, actorId: req.auth_context?.actor_id ?? "", requestId: req.requestId, productionJobId: job.id } })
    return res.json({ file, requestId: req.requestId })
  } catch (error) { return res.status(409).json({ code: "ARTWORK_NOT_APPROVABLE", message: error instanceof Error ? error.message : "Artwork review failed", requestId: req.requestId }) }
}
