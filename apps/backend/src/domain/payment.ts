export type PaymentAttemptDisposition = "complete" | "reconcile" | "reject"
export type PublicPaymentStatus = "payment_pending" | "payment_succeeded" | "artifact_pending" | "order_complete" | "payment_failed"

export function publicPaymentStatus(input: { eventStatus?: string; eventType?: string; orderId?: string | null }): PublicPaymentStatus {
  const status = input.eventStatus?.toLowerCase()
  if (status && ["failure", "failed", "canceled", "cancelled", "invalid", "rejected"].includes(status)) return "payment_failed"
  if (status === "completed") return "order_complete"
  if (status === "artifact_pending" || status === "reconciliation_required" || status === "manual_review") return "artifact_pending"
  if (status === "success" || status === "captured" || status === "authorized" || status === "verified") return "payment_succeeded"
  return "payment_pending"
}

export function paymentLockIsActive(expiresAt: Date | string | number, now = Date.now()): boolean {
  const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt)
  return Number.isFinite(timestamp) && timestamp > now
}

export function paymentCallbackDisposition(input: { status: string; attemptStatus: string; attemptRevisionHash: string; currentCartRevisionHash?: string; expiresAt: Date | string | number; now?: number }): PaymentAttemptDisposition {
  if (input.attemptStatus !== "active" || !paymentLockIsActive(input.expiresAt, input.now)) return input.status.toLowerCase() === "success" ? "reconcile" : "reject"
  if (!input.currentCartRevisionHash || input.currentCartRevisionHash !== input.attemptRevisionHash) return input.status.toLowerCase() === "success" ? "reconcile" : "reject"
  return "complete"
}
