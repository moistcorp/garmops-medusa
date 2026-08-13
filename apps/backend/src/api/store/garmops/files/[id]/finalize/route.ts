import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../../modules/garmops/service"
import { verifyObject } from "../../../../../../integrations/r2"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  try {
    const file = await service.retrieveStoredFile(req.params.id)
    if (file.customer_id && file.customer_id !== req.auth_context?.actor_id) return res.status(404).json({ code: "FILE_NOT_FOUND", message: "File not found", requestId: req.requestId })
    if (file.state !== "pending") return res.status(409).json({ code: "FILE_NOT_PENDING", message: "File is not awaiting finalization", requestId: req.requestId })
    await verifyObject({ key: file.object_key, fileId: file.id, expectedBytes: Number(file.byte_size), sha256: file.sha256 ?? undefined })
    const updated = await service.updateStoredFiles({ id: file.id, state: "uploaded" })
    res.json({ file: updated, scanStatus: file.scan_status, requestId: req.requestId })
  } catch (error) {
    res.status(409).json({ code: "UPLOAD_NOT_VERIFIED", message: error instanceof Error ? error.message : "Upload could not be verified", requestId: req.requestId })
  }
}
