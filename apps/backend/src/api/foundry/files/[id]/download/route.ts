import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../modules/garmops/service"
import { hasStaffPermission } from "../../../../../auth/staff"
import { createSignedDownload } from "../../../../../integrations/r2"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "review_artwork"))) return res.status(403).json({ code: "FORBIDDEN", message: "Artwork review permission required", requestId: req.requestId })
  try {
    const file = await service.retrieveStoredFile(req.params.id)
    if (file.scan_status !== "clean" || (file.state !== "uploaded" && file.state !== "finalized")) return res.status(423).json({ code: "FILE_SCAN_PENDING", message: "File is not cleared for download", requestId: req.requestId })
    res.json({ url: await createSignedDownload(file.object_key), expiresIn: 300, requestId: req.requestId })
  } catch {
    res.status(404).json({ code: "FILE_NOT_FOUND", message: "File not found", requestId: req.requestId })
  }
}
