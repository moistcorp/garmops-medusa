import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../modules/garmops/service"
import { hasStaffPermission } from "../../../../../auth/staff"
import { requestPayuRefund } from "../../../../../services/refund"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "manage_refunds"))) return res.status(403).json({ code: "FORBIDDEN", message: "Founder permission required", requestId: req.requestId })
  const body = req.body as { amountPaise?: number; idempotencyKey?: string }
  if (!body.idempotencyKey || (body.amountPaise !== undefined && !Number.isSafeInteger(body.amountPaise))) return res.status(400).json({ code: "INVALID_REFUND", message: "A unique refund idempotency key is required", requestId: req.requestId })
  try {
    const refund = await requestPayuRefund(req.scope, { paymentId: req.params.id, amountPaise: body.amountPaise, idempotencyKey: body.idempotencyKey, actorId: req.auth_context?.actor_id ?? "" })
    res.status(201).json({ refund, requestId: req.requestId })
  } catch (error) {
    if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") return res.status(409).json({ code: "IDEMPOTENCY_KEY_REUSED", message: "This idempotency key was already used for a different refund", requestId: req.requestId })
    res.status(409).json({ code: "REFUND_FAILED", message: error instanceof Error ? error.message : "Refund could not be submitted", requestId: req.requestId })
  }
}
