import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../../modules/garmops/service"
import { completeVerifiedPayuPayment } from "../../../../../../services/order-completion"
import { ownedCart } from "../../../../../../services/garmops-cart"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { cartId?: string; txnid?: string }
  const customerId = req.auth_context?.actor_id
  if (!customerId || !body.cartId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication and cartId are required", requestId: req.requestId })
  try {
    await ownedCart(req.scope, body.cartId, customerId)
    const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
    const event = ((await service.listPaymentEvents({ cart_id: body.cartId }, { order: { created_at: "DESC" }, take: 20 })).find((item) => !body.txnid || item.provider_transaction_id === body.txnid))
    if (!event) return res.status(404).json({ code: "PAYMENT_NOT_FOUND", message: "No payment attempt exists for this cart", requestId: req.requestId })
    if (event.status === "completed") return res.json({ status: "order_complete", orderId: event.order_id, requestId: req.requestId })
    if (event.status === "reconciliation_required") return res.json({ status: "artifact_pending", message: "Payment was captured but the cart changed after payment; it cannot be auto-completed", requestId: req.requestId })
    if (!["success", "artifact_pending"].includes(event.status)) return res.json({ status: "payment_pending", requestId: req.requestId })
    const completed = await completeVerifiedPayuPayment(req.scope, { cartId: body.cartId, providerTransactionId: event.provider_transaction_id, paymentId: event.payment_id ?? undefined })
    await service.markPaymentEvent({ id: event.id, status: "completed", orderId: completed.order.id })
    return res.json({ status: "order_complete", orderId: completed.order.id, orderNumber: completed.orderNumber, requestId: req.requestId })
  } catch (error) { return res.status(202).json({ status: "artifact_pending", message: error instanceof Error ? error.message : "Payment reconciliation is pending", requestId: req.requestId }) }
}
