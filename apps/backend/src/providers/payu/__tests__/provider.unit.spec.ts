import { PayuPaymentProvider } from "../index"

describe("PayU provider contract", () => {
  it("builds an INR minor-unit payment request", async () => {
    const provider = new PayuPaymentProvider({}, { key: "merchant", salt: "secret", environment: "test" })
    const result = await provider.initiatePayment({ amount: 53500, currency_code: "inr", data: { txnid: "txn-1", cart_id: "cart-1" } })
    expect(result.id).toBe("txn-1")
    expect((result.data?.fields as Record<string, unknown>).amount).toBe("535.00")
  })
  it("does not authorize a session before a verified server event", async () => {
    const provider = new PayuPaymentProvider({}, { key: "merchant", salt: "secret" })
    expect((await provider.authorizePayment({ data: {} })).status).toBe("pending_authorization")
    expect((await provider.authorizePayment({ data: { verified: true, provider_status: "success" } })).status).toBe("captured")
  })
})
