import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest, MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"

export const removeServerFingerprint = async (_req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
  res.removeHeader("X-Powered-By")
  await next()
}

const requestId = async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
  const id = req.get("x-request-id")?.slice(0, 128) || randomUUID()
  req.requestId = id
  res.setHeader("x-request-id", id)
  await next()
}

/**
 * Medusa's native admin API is a separate privilege boundary from Foundry.
 * Every native admin caller must therefore also be an active Founder in the
 * Garmops staff registry. Operations users are deliberately denied by
 * default, including for endpoints that Foundry does not currently expose.
 */
export const protectNativeAdmin = async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
  const actorId = (req as AuthenticatedMedusaRequest).auth_context?.actor_id
  if (!actorId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Native administration authentication is required" })
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const staff = (await service.listStaffMembers({ auth_user_id: actorId, active: true }))[0]
  if (!staff || staff.role !== "founder") return res.status(403).json({ code: "NATIVE_ADMIN_FORBIDDEN", message: "Native Medusa administration is restricted to Founders" })
  await next()
}

export default defineMiddlewares({
  routes: [
    { matcher: "/*", middlewares: [removeServerFingerprint] },
    { matcher: "/*", middlewares: [requestId] },
    { matcher: "/admin", middlewares: [authenticate("user", ["session", "bearer"]), protectNativeAdmin] },
    { matcher: "/admin/*", middlewares: [authenticate("user", ["session", "bearer"]), protectNativeAdmin] },
    { matcher: "/foundry/*", middlewares: [authenticate("user", ["session", "bearer"])] },
    { matcher: "/store/garmops/cart*", middlewares: [authenticate("customer", ["session", "bearer"]) ] },
    { matcher: "/store/garmops/cart-profile", middlewares: [authenticate("customer", ["session", "bearer"]) ] },
    { matcher: "/store/garmops/cart-lines*", middlewares: [authenticate("customer", ["session", "bearer"]) ] },
    { matcher: "/store/garmops/sample-cart*", middlewares: [authenticate("customer", ["session", "bearer"]) ] },
    { matcher: "/store/garmops/sample-checkout", middlewares: [authenticate("customer", ["session", "bearer"]) ] },
    { matcher: "/store/garmops/checkout*", middlewares: [authenticate("customer", ["session", "bearer"]) ] },
    { matcher: "/store/garmops/orders*", middlewares: [authenticate("customer", ["session", "bearer"]) ] },
    { matcher: "/store/garmops/invoices*", middlewares: [authenticate("customer", ["session", "bearer"]) ] },
    { matcher: "/store/garmops/designs*", middlewares: [authenticate("customer", ["session", "bearer"])] },
    { matcher: "/store/garmops/files/*", middlewares: [authenticate("customer", ["session", "bearer"])] },
    { matcher: "/store/garmops/payments/payu/initiate", middlewares: [authenticate("customer", ["session", "bearer"])] },
    { matcher: "/store/garmops/payments/payu/status", middlewares: [authenticate("customer", ["session", "bearer"]) ] },
    { matcher: "/store/garmops/payments/payu/recheck", middlewares: [authenticate("customer", ["session", "bearer"]) ] },
  ],
})
