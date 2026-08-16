export type PaymentAttemptDisposition = "complete" | "reconcile" | "reject"

export function paymentLockIsActive(expiresAt: Date | string | number, now = Date.now()): boolean {
  const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt)
  return Number.isFinite(timestamp) && timestamp > now
}

export function paymentCallbackDisposition(input: { status: string; attemptStatus: string; attemptRevisionHash: string; currentCartRevisionHash?: string; expiresAt: Date | string | number; now?: number }): PaymentAttemptDisposition {
  if (input.attemptStatus !== "active" || !paymentLockIsActive(input.expiresAt, input.now)) return input.status.toLowerCase() === "success" ? "reconcile" : "reject"
  if (!input.currentCartRevisionHash || input.currentCartRevisionHash !== input.attemptRevisionHash) return input.status.toLowerCase() === "success" ? "reconcile" : "reject"
  return "complete"
}
