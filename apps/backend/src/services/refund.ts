import { Modules } from "@medusajs/framework/utils"
import type { IPaymentModuleService } from "@medusajs/framework/types"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { MedusaError } from "@medusajs/framework/utils"

export async function requestPayuRefund(container: { resolve<T>(key: string): T }, input: { paymentId: string; amountPaise?: number; idempotencyKey: string; actorId: string }) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const existing = (await service.listRefundRequests({ idempotency_key: input.idempotencyKey }))[0]
  if (existing) return existing
  const payments = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const payment = await payments.retrievePayment(input.paymentId)
  const available = Number(payment.captured_amount ?? payment.amount) - Number(payment.refunded_amount ?? 0)
  const amountPaise = input.amountPaise ?? available
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise > available) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Refund amount exceeds the captured balance")
  const request = await service.createRefundRequests({ payment_id: input.paymentId, amount_paise: amountPaise, idempotency_key: input.idempotencyKey, requested_by: input.actorId, status: "pending", provider_reference: null, last_error: null })
  try {
    const updated = await payments.refundPayment({ payment_id: input.paymentId, amount: amountPaise, created_by: input.actorId, note: "Garmops Founder refund", metadata: { garmops_refund_request_id: request.id } })
    return service.updateRefundRequests({ id: request.id, status: "submitted", provider_reference: String(updated.id ?? input.paymentId), last_error: null })
  } catch (error) {
    await service.updateRefundRequests({ id: request.id, status: "failed", last_error: error instanceof Error ? error.message : "PayU refund failed" })
    throw error
  }
}
