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
  if (!body.configuration || !Number.isInteger(body.quantity) || !Number.isInteger(body.revision)) return res.status(400).json({ code: "INVALID_REVISION", message: "Revision, configuration, and quantity are required", requestId: req.requestId })
  const latest = (await service.listDesignVersions({ project_id: project.id }, { order: { revision: "DESC" }, take: 1 }))[0]
  if (!latest || latest.revision !== body.revision) return res.status(409).json({ code: "STALE_DESIGN_REVISION", message: "Design has changed; reload before saving", requestId: req.requestId })
  const { result } = await updateGarmopsDesignWorkflow(req.scope).run({ input: { projectId: project.id, productSlug: body.productSlug ?? project.product_slug, configuration: body.configuration, quantity: body.quantity as number } })
  res.json({ ...result, requestId: req.requestId })
}
