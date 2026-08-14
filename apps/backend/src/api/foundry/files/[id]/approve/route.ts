import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../modules/garmops/service"
import { hasStaffPermission } from "../../../../../auth/staff"
import { approveStoredFile } from "../../../../../services/file-scan"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "review_artwork"))) return res.status(403).json({ code: "FORBIDDEN", message: "Artwork review permission required", requestId: req.requestId })
  try {
    const file = await approveStoredFile(req.scope, req.params.id)
    res.json({ file, requestId: req.requestId })
  } catch (error) {
    res.status(409).json({ code: "ARTWORK_NOT_APPROVABLE", message: error instanceof Error ? error.message : "Artwork is not approvable", requestId: req.requestId })
  }
}
