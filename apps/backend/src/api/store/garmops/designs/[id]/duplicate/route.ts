import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../../modules/garmops/service"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const source = await service.retrieveDesignProject(req.params.id)
  if (source.owner_customer_id !== req.auth_context?.actor_id) return res.status(404).json({ code: "NOT_FOUND", message: "Design not found", requestId: req.requestId })
  const body = req.body as { clientOperationId?: string }
  const project = await service.duplicateProject({ projectId: source.id, ownerCustomerId: req.auth_context?.actor_id ?? "", clientOperationId: body.clientOperationId })
  res.status(201).json({ project, requestId: req.requestId })
}
