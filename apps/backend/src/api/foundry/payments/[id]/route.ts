import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { GARMOPS_MODULE } from "../../../../modules/garmops"
import type GarmopsModuleService from "../../../../modules/garmops/service"
import { hasStaffPermission } from "../../../../auth/staff"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "view_raw_payments"))) return res.status(403).json({ code: "FORBIDDEN", message: "Founder payment permission required", requestId: req.requestId })
  try {
    const payment = await req.scope.resolve<any>(Modules.PAYMENT).retrievePayment(req.params.id)
    return res.json({ payment: { id: payment.id, amount: payment.amount, currencyCode: payment.currency_code, capturedAmount: payment.captured_amount, refundedAmount: payment.refunded_amount, data: payment.data }, requestId: req.requestId })
  } catch (error) { return res.status(404).json({ code: "PAYMENT_NOT_FOUND", message: error instanceof Error ? error.message : "Payment not found", requestId: req.requestId }) }
}
