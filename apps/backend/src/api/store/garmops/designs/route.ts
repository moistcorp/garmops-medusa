import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../modules/garmops"
import type GarmopsModuleService from "../../../../modules/garmops/service"
import { findCatalogProduct } from "../../../../domain/catalog"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const projects = await service.listDesignProjects({ owner_customer_id: req.auth_context?.actor_id, archived: false }, { order: { updated_at: "DESC" } })
  res.json({ projects, requestId: req.requestId })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { title?: string; productSlug?: string; configuration?: Record<string, unknown>; quantity?: number }
  const customerId = req.auth_context?.actor_id
  if (!customerId || !body.title || !body.productSlug || !findCatalogProduct(body.productSlug) || !body.configuration || !Number.isInteger(body.quantity) || (body.quantity ?? 0) <= 0) return res.status(400).json({ code: "INVALID_DESIGN", message: "A valid product, title, configuration, and quantity are required", requestId: req.requestId })
  const quantity = body.quantity as number
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const project = await service.createDesignProjects({ owner_customer_id: customerId, title: body.title.trim(), product_slug: body.productSlug, active_version_id: null, source: "configurator", archived: false, metadata: null })
  const version = await service.createVersion({ projectId: project.id, productSlug: body.productSlug, configuration: body.configuration, quantity })
  const saved = await service.updateDesignProjects({ id: project.id, active_version_id: version.id })
  res.status(201).json({ project: saved, version, requestId: req.requestId })
}
