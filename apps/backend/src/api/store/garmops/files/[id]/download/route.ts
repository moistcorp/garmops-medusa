import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../../modules/garmops/service"
import { createSignedDownload } from "../../../../../../integrations/r2"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  try {
    const file = await service.retrieveStoredFile(req.params.id)
    if (file.customer_id !== req.auth_context?.actor_id) return res.status(404).json({ code: "FILE_NOT_FOUND", message: "File not found", requestId: req.requestId })
    if (file.state !== "uploaded" && file.state !== "finalized") return res.status(409).json({ code: "FILE_NOT_READY", message: "File is not ready for download", requestId: req.requestId })
    if (file.scan_status !== "clean") return res.status(423).json({ code: "FILE_SCAN_PENDING", message: "File is not cleared for download", requestId: req.requestId })
    const url = await createSignedDownload(file.object_key)
    res.json({ url, expiresIn: 300, requestId: req.requestId })
  } catch (error) {
    res.status(404).json({ code: "FILE_NOT_FOUND", message: "File not found", requestId: req.requestId })
  }
}
