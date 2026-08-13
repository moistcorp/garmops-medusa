import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"

const requestId = async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
  const id = req.get("x-request-id")?.slice(0, 128) || randomUUID()
  req.requestId = id
  res.setHeader("x-request-id", id)
  await next()
}
export default defineMiddlewares({
  routes: [
    { matcher: "/*", middlewares: [requestId] },
    { matcher: "/foundry/*", middlewares: [authenticate("user", ["session", "bearer"])] },
    { matcher: "/store/garmops/designs*", middlewares: [authenticate("customer", ["session", "bearer"])] },
    { matcher: "/store/garmops/files/*", middlewares: [authenticate("customer", ["session", "bearer"])] },
  ],
})
