import { paymentCallbackDisposition, paymentLockIsActive, publicPaymentStatus } from "../payment"

describe("PayU payment attempt integrity", () => {
  it("distinguishes an active lock from an expired lock", () => {
    expect(paymentLockIsActive("2026-08-16T12:01:00.000Z", Date.parse("2026-08-16T12:00:00.000Z"))).toBe(true)
    expect(paymentLockIsActive("2026-08-16T11:59:00.000Z", Date.parse("2026-08-16T12:00:00.000Z"))).toBe(false)
  })

  it("never completes a success callback for an invalidated or changed revision", () => {
    const input = { status: "success", attemptStatus: "active", attemptRevisionHash: "revision-a", expiresAt: Date.now() + 60_000, currentCartRevisionHash: "revision-b" }
    expect(paymentCallbackDisposition(input)).toBe("reconcile")
    expect(paymentCallbackDisposition({ ...input, attemptStatus: "invalidated", currentCartRevisionHash: "revision-a" })).toBe("reconcile")
    expect(paymentCallbackDisposition({ ...input, currentCartRevisionHash: "revision-a" })).toBe("complete")
  })

  it("completes only when the current cart revision equals the revision that was paid for", () => {
    const base = { status: "success", attemptStatus: "active", attemptRevisionHash: "revision-a", expiresAt: Date.now() + 60_000 }
    expect(paymentCallbackDisposition({ ...base, currentCartRevisionHash: "revision-a" })).toBe("complete")
    expect(paymentCallbackDisposition({ ...base, currentCartRevisionHash: "revision-b" })).toBe("reconcile")
  })

  it("rejects a success callback when the quantity changed after payment initiation", () => {
    const attempt = { status: "success", attemptStatus: "active", attemptRevisionHash: "paid-cart-revision-a", expiresAt: Date.now() + 60_000 }
    expect(paymentCallbackDisposition({ ...attempt, currentCartRevisionHash: "paid-cart-revision-a" })).toBe("complete")
    expect(paymentCallbackDisposition({ ...attempt, currentCartRevisionHash: "paid-cart-revision-b-quantity-changed" })).toBe("reconcile")
  })

  it("rejects a success callback when a product was removed after payment initiation", () => {
    const attempt = { status: "success", attemptStatus: "active", attemptRevisionHash: "paid-cart-revision-a", expiresAt: Date.now() + 60_000 }
    expect(paymentCallbackDisposition({ ...attempt, currentCartRevisionHash: "paid-cart-revision-b-product-removed" })).toBe("reconcile")
  })

  it("rejects a success callback when delivery data changed after payment initiation", () => {
    const attempt = { status: "success", attemptStatus: "active", attemptRevisionHash: "paid-cart-revision-a", expiresAt: Date.now() + 60_000 }
    expect(paymentCallbackDisposition({ ...attempt, currentCartRevisionHash: "paid-cart-revision-b-delivery-changed" })).toBe("reconcile")
  })

  it("routes an expired or invalidated attempt to reconciliation instead of completion", () => {
    const attempt = { status: "success", attemptStatus: "active", attemptRevisionHash: "revision-a", expiresAt: Date.now() - 60_000, currentCartRevisionHash: "revision-a" }
    expect(paymentCallbackDisposition(attempt)).toBe("reconcile")
    expect(paymentCallbackDisposition({ ...attempt, attemptStatus: "invalidated", expiresAt: Date.now() + 60_000 })).toBe("reconcile")
  })

  it("rejects a failed callback for an invalidated attempt rather than reconciling it", () => {
    const attempt = { status: "failure", attemptStatus: "invalidated", attemptRevisionHash: "revision-a", expiresAt: Date.now() - 60_000, currentCartRevisionHash: "revision-a" }
    expect(paymentCallbackDisposition(attempt)).toBe("reject")
  })

  it("maps explicit provider and artifact states without inferring success from an order id", () => {
    expect(publicPaymentStatus({ eventStatus: "initiated", orderId: "order_1" })).toBe("payment_pending")
    expect(publicPaymentStatus({ eventStatus: "failed", orderId: "order_1" })).toBe("payment_failed")
    expect(publicPaymentStatus({ eventStatus: "artifact_pending", orderId: "order_1" })).toBe("artifact_pending")
    expect(publicPaymentStatus({ eventStatus: "completed", orderId: "order_1" })).toBe("order_complete")
  })
})
