import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { randomUUID } from "node:crypto"
import { GARMOPS_MODULE } from "../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../modules/garmops/service"
import { validateUpload } from "../../../../../domain/files"
import { createSignedUpload, privateBucket } from "../../../../../integrations/r2"
import { createGarmopsStoredFileWorkflow } from "../../../../../workflows/garmops-mutations"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validated = validateUpload(req.body)
  if (!validated.ok) return res.status(400).json({ code: "INVALID_UPLOAD", message: validated.error })
  try {
    const fileId = randomUUID()
    const input = validated.value
    const key = `garmops/${input.kind}/${fileId}/${input.safeFilename}`
    const actorId = (req as MedusaRequest & { auth_context?: { actor_id?: string } }).auth_context?.actor_id
    if (!actorId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required" })
    const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
    if (input.designProjectId) {
      const project = await service.retrieveDesignProject(input.designProjectId)
      if (project.owner_customer_id !== actorId) return res.status(404).json({ code: "UPLOAD_TARGET_NOT_FOUND", message: "Upload target not found" })
    }
    if (input.orderId) {
      const order = await req.scope.resolve<any>(Modules.ORDER).retrieveOrder(input.orderId)
      if (order.customer_id !== actorId) return res.status(404).json({ code: "UPLOAD_TARGET_NOT_FOUND", message: "Upload target not found" })
    }
    await createGarmopsStoredFileWorkflow(req.scope).run({ input: { id: fileId, object_key: key, bucket: privateBucket(), purpose: input.kind, kind: input.kind, visibility: "private", original_filename: input.filename, safe_filename: input.safeFilename, content_type: input.contentType, extension: input.extension, byte_size: input.byteSize, sha256: input.sha256 ?? null, uploaded_by: actorId, customer_id: actorId, project_id: input.designProjectId ?? null, order_id: input.orderId ?? null, replacement_for_file_id: null, scan_status: "pending", state: "pending", finalized_at: null, metadata: null } })
    const signed = await createSignedUpload({ key, contentType: input.contentType, contentLength: input.byteSize, fileId, sha256: input.sha256 })
    res.status(201).json({ fileId, bucket: privateBucket(), key, uploadUrl: signed.url, expiresIn: 600, state: "pending" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload storage is unavailable"
    if (message.toLowerCase().includes("not found")) return res.status(404).json({ code: "UPLOAD_TARGET_NOT_FOUND", message: "Upload target not found" })
    res.status(503).json({ code: "UPLOAD_UNAVAILABLE", message })
  }
}
