import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { GARMOPS_MODULE } from "../../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../../modules/garmops/service"
import { ownedCart } from "../../../../../../services/garmops-cart"
import { publicPaymentStatus } from "../../../../../../domain/payment"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  const cartId = String(req.query.cartId ?? "")
  const transactionId = String(req.query.txnid ?? "")
  if (!customerId || !cartId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication and cartId are required", requestId: req.requestId })
  try {
    await ownedCart(req.scope, cartId, customerId)
    const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
    const events = await service.listPaymentEvents({ cart_id: cartId }, { order: { created_at: "DESC" }, take: 20 })
    const event = transactionId ? events.find((item) => item.provider_transaction_id === transactionId) : events[0]
    const payment = event?.payment_session_id ? await req.scope.resolve<any>(Modules.PAYMENT).retrievePaymentSession(event.payment_session_id) : undefined
    const orderNumber = event?.order_id ? (await service.listProductionJobs({ order_id: event.order_id }, { take: 1 }))[0]?.order_number ?? null : null
    const status = publicPaymentStatus({ eventStatus: event?.status, eventType: event?.event_type, orderId: event?.order_id })
    return res.json({ status, orderId: event?.order_id ?? null, orderNumber, transactionId: event?.provider_transaction_id ?? null, paymentState: payment?.status ?? null, requestId: req.requestId })
  } catch (error) { return res.status(404).json({ code: "PAYMENT_NOT_FOUND", message: error instanceof Error ? error.message : "Payment status not found", requestId: req.requestId }) }
}
