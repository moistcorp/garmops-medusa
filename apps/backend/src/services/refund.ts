import { Modules } from "@medusajs/framework/utils"
import type { IPaymentModuleService } from "@medusajs/framework/types"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { MedusaError } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import { medusaAmountToPaise, paiseToMedusaAmount } from "../domain/money"

export async function requestPayuRefund(container: { resolve<T>(key: string): T }, input: { paymentId: string; amountPaise?: number; idempotencyKey: string; actorId: string }) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const payments = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const payment = await payments.retrievePayment(input.paymentId)
  const paymentData = (payment.data ?? {}) as Record<string, unknown>
  const providerTransactionId = String(paymentData.txnid ?? paymentData.mihpayid ?? "")
  const paymentEvents = (await service.listPaymentEvents({ payment_id: input.paymentId }))
  const event = paymentEvents[0] ?? (providerTransactionId ? (await service.listPaymentEvents({ provider_transaction_id: providerTransactionId }))[0] : undefined)
  const orderId = event?.order_id
  if (!orderId) throw new MedusaError(MedusaError.Types.CONFLICT, "The paid order for this payment could not be resolved")
  const available = medusaAmountToPaise(payment.captured_amount ?? payment.amount, "Captured payment amount") - medusaAmountToPaise(payment.refunded_amount ?? 0, "Refunded payment amount")
  const amountPaise = input.amountPaise ?? available
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise > available) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Refund amount exceeds the captured balance")
  const fingerprint = refundFingerprint({ paymentId: input.paymentId, orderId, amountPaise, currency: payment.currency_code })
  const existing = (await service.listRefundRequests({ idempotency_key: input.idempotencyKey }))[0]
  if (existing) {
    if (existing.request_fingerprint !== fingerprint) throw new MedusaError(MedusaError.Types.CONFLICT, "IDEMPOTENCY_KEY_REUSED")
    return existing
  }
  let request
  try {
    request = await service.createRefundRequests({ payment_id: input.paymentId, order_id: orderId, amount_paise: amountPaise, request_fingerprint: fingerprint, idempotency_key: input.idempotencyKey, requested_by: input.actorId, status: "pending", provider_reference: null, last_error: null, submitted_at: null, completed_at: null })
  } catch (error) {
    const concurrent = (await service.listRefundRequests({ idempotency_key: input.idempotencyKey }))[0]
    if (concurrent) {
      if (concurrent.request_fingerprint !== fingerprint) throw new MedusaError(MedusaError.Types.CONFLICT, "IDEMPOTENCY_KEY_REUSED")
      return concurrent
    }
    throw error
  }
  let updated: Awaited<ReturnType<IPaymentModuleService["refundPayment"]>>
  try {
    updated = await payments.refundPayment({ payment_id: input.paymentId, amount: paiseToMedusaAmount(amountPaise, "Refund amount"), created_by: input.actorId, note: "Garmops Founder refund", metadata: { garmops_refund_request_id: request.id } })
  } catch (error) {
    await service.updateRefundRequests({ id: request.id, status: "failed", last_error: error instanceof Error ? error.message : "PayU refund failed" })
    throw error
  }
  const submitted = await service.updateRefundRequests({ id: request.id, status: "submitted", provider_reference: String((updated as { id?: unknown }).id ?? input.paymentId), submitted_at: new Date(), last_error: null })
  const jobs = await service.listProductionJobs({ order_id: orderId })
  const job = jobs[0]
  if (job && !["refund_pending", "refunded"].includes(job.status)) {
    await service.updateProductionJobs({ id: job.id, status: "refund_pending", metadata: { ...(job.metadata as Record<string, unknown> ?? {}), refundRequestId: request.id, refundProviderReference: submitted.provider_reference } })
    await service.createProductionStatusHistories({ production_job_id: job.id, from_status: job.status, to_status: "refund_pending", actor_id: input.actorId, request_id: null, reason: "PayU refund submitted" })
  }
  return submitted
}

export async function reconcilePayuRefund(container: { resolve<T>(key: string): T }, refundId: string) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const request = await service.retrieveRefundRequest(refundId)
  if (request.status !== "submitted" || !request.order_id) return request
  const payments = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const payment = await payments.retrievePayment(request.payment_id)
  const data = (payment.data ?? {}) as Record<string, unknown>
  const providerResponse = data.provider_response && typeof data.provider_response === "object" ? data.provider_response as Record<string, unknown> : {}
  const providerStatus = String(data.refund_status ?? data.refundStatus ?? providerResponse.refund_status ?? providerResponse.refundStatus ?? "").toLowerCase()
  if (["failed", "failure", "rejected", "cancelled", "canceled"].includes(providerStatus)) return service.updateRefundRequests({ id: request.id, status: "failed", last_error: "PayU reported refund failure" })
  if (!["success", "successful", "completed", "refunded", "1"].includes(providerStatus)) return request
  const captured = medusaAmountToPaise(payment.captured_amount ?? payment.amount, "Captured payment amount")
  const refunded = medusaAmountToPaise(payment.refunded_amount ?? 0, "Refunded payment amount")
  if (request.amount_paise < captured && refunded < captured) return request
  const completed = await service.updateRefundRequests({ id: request.id, status: "completed", completed_at: new Date(), last_error: null })
  const job = (await service.listProductionJobs({ order_id: request.order_id }))[0]
  if (job && job.status !== "refunded") {
    await service.updateProductionJobs({ id: job.id, status: "refunded", artwork_review_status: job.artwork_review_status, metadata: { ...(job.metadata as Record<string, unknown> ?? {}), refundRequestId: request.id } })
    await service.createProductionStatusHistories({ production_job_id: job.id, from_status: job.status, to_status: "refunded", actor_id: null, request_id: null, reason: "PayU refund confirmed" })
  }
  return completed
}

function refundFingerprint(input: { paymentId: string; orderId: string; amountPaise: number; currency?: string | null }): string {
  return createHash("sha256").update(JSON.stringify({ paymentId: input.paymentId, orderId: input.orderId, amountPaise: input.amountPaise, currency: String(input.currency ?? "").toLowerCase() })).digest("hex")
}
