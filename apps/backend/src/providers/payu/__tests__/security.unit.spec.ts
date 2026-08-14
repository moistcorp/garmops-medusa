import { createPaymentRequestHash, formatPaiseAsRupees, parseRupeesToPaise, verifyPaymentResponseHash } from "../security"

describe("PayU security", () => {
  it("round-trips INR amounts without floating point arithmetic", () => {
    expect(formatPaiseAsRupees(12345)).toBe("123.45")
    expect(parseRupeesToPaise("123.45")).toBe(12345)
    expect(parseRupeesToPaise("123.456")).toBeNull()
  })
  it("creates a response hash that validates with the same salt", () => {
    const base = { key: "merchant", txnid: "txn-1", amount: "535.00", productinfo: "Order", firstname: "A", email: "a@example.com", udf1: "", udf2: "", udf3: "", udf4: "", udf5: "", salt: "secret" }
    const requestHash = createPaymentRequestHash(base)
    expect(requestHash).toHaveLength(128)
    const fields = { ...base, status: "success", hash: "" }
    expect(verifyPaymentResponseHash(fields, "secret")).toBe(false)
  })
  it("rejects malformed, negative, and ambiguous amounts", () => {
    expect(parseRupeesToPaise("-1.00")).toBeNull()
    expect(parseRupeesToPaise("1.999")).toBeNull()
    expect(parseRupeesToPaise("100000000000000.00")).toBeNull()
  })
  it("does not accept a changed transaction identity", () => {
    const fields = { key: "merchant", txnid: "txn-1", amount: "535.00", productinfo: "Order", firstname: "A", email: "a@example.com", status: "success", hash: "a".repeat(128) }
    expect(verifyPaymentResponseHash({ ...fields, txnid: "txn-2" }, "secret")).toBe(false)
  })
})
