import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../modules/garmops"
import type GarmopsModuleService from "../../../../modules/garmops/service"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { cartId?: string; cartType?: string }
  if (!body.cartId || !["configured", "sample"].includes(body.cartType ?? "")) return res.status(400).json({ code: "INVALID_CART_TYPE", message: "Cart ID and configured/sample type are required", requestId: req.requestId })
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const existing = await service.listCartProfiles({ cart_id: body.cartId })
  if (existing[0] && existing[0].cart_type !== body.cartType) return res.status(409).json({ code: "CART_TYPE_MISMATCH", message: "Configured and sample carts cannot be mixed", requestId: req.requestId })
  const profile = existing[0] ?? await service.createCartProfiles({ cart_id: body.cartId, cart_type: body.cartType as "configured" | "sample", customer_id: req.auth_context?.actor_id ?? null })
  res.status(existing[0] ? 200 : 201).json({ profile, requestId: req.requestId })
}
