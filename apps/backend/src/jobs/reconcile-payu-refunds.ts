import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { reconcilePayuRefund } from "../services/refund"

export default async function reconcilePayuRefunds(container: MedusaContainer) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as { warn(message: string): void }
  const requests = await service.listRefundRequests({ status: "submitted" }, { take: 100 })
  for (const request of requests) {
    try { await reconcilePayuRefund(container, request.id) } catch (error) { logger.warn(`PayU refund reconciliation pending for ${request.id}: ${error instanceof Error ? error.message : "unknown error"}`) }
  }
}

export const config = { name: "garmops-payu-refund-reconciliation", schedule: { interval: 60_000 } }
