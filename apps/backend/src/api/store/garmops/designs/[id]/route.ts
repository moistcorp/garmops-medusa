import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../modules/garmops/service"
import { updateGarmopsDesignWorkflow } from "../../../../../workflows/garmops-mutations"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const project = await service.retrieveDesignProject(req.params.id)
  if (project.owner_customer_id !== req.auth_context?.actor_id) return res.status(404).json({ code: "NOT_FOUND", message: "Design not found", requestId: req.requestId })
  const versions = await service.listDesignVersions({ project_id: project.id }, { order: { revision: "DESC" } })
  res.json({ project, versions, requestId: req.requestId })
}

export async function PATCH(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { revision?: number; configuration?: Record<string, unknown>; quantity?: number; productSlug?: string; clientOperationId?: string }
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const project = await service.retrieveDesignProject(req.params.id)
  if (project.owner_customer_id !== req.auth_context?.actor_id) return res.status(404).json({ code: "NOT_FOUND", message: "Design not found", requestId: req.requestId })
  if (!body.configuration || !Number.isInteger(body.quantity) || !Number.isInteger(body.revision) || (body.revision ?? 0) < 1) return res.status(400).json({ code: "INVALID_REVISION", message: "Revision, configuration, and quantity are required", requestId: req.requestId })
  if (!body.clientOperationId) return res.status(400).json({ code: "CLIENT_OPERATION_REQUIRED", message: "A client operation id is required for design saves", requestId: req.requestId })
  const quantity = body.quantity as number
  const expectedRevision = body.revision as number
  const configuration = body.configuration
  const { result } = await updateGarmopsDesignWorkflow(req.scope).run({ input: { projectId: project.id, productSlug: body.productSlug ?? project.product_slug, configuration, quantity, expectedRevision, clientOperationId: body.clientOperationId } })
  res.json({ ...result, requestId: req.requestId })
}
