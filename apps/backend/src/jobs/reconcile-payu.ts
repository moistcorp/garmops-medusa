import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { completeVerifiedPayuPayment } from "../services/order-completion"

export default async function reconcilePayu(container: MedusaContainer) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as { warn(message: string): void; info(message: string): void }
  const events = await service.listPaymentEvents({ status: "artifact_pending" }, { take: 100 })
  for (const event of events) {
    if (!event.cart_id || !event.provider_transaction_id) continue
    try {
      const completed = await completeVerifiedPayuPayment(container, { cartId: event.cart_id, providerTransactionId: event.provider_transaction_id, paymentId: event.payment_id ?? undefined })
      await service.markPaymentEvent({ id: event.id, status: "completed", orderId: completed.order.id })
    } catch (error) {
      logger.warn(`PayU reconciliation pending for ${event.provider_transaction_id}: ${error instanceof Error ? error.message : "unknown error"}`)
    }
  }
  if (events.length) logger.info(`PayU reconciliation inspected ${events.length} event(s)`)
}

export const config = { name: "garmops-payu-reconciliation", schedule: { interval: 60_000 } }
