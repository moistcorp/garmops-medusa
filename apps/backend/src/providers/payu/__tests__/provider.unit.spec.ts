import { PayuPaymentProvider } from "../index"
import { createPaymentRequestHash, type PayuRequestFields } from "../security"

describe("PayU provider contract", () => {
  it("builds an INR major-unit payment request with phone and exact hashed UDF fields", async () => {
    const provider = new PayuPaymentProvider({}, { key: "merchant", salt: "secret", environment: "test", callbackUrl: "https://api.example.test/garmops/payments/payu/callback" })
    const result = await provider.initiatePayment({ amount: 535, currency_code: "inr", data: { txnid: "txn-1", cart_id: "cart-1", phone: "9876543210" } })
    expect(result.id).toBe("txn-1")
    expect((result.data?.fields as Record<string, unknown>)).toMatchObject({
      amount: "535.00",
      phone: "9876543210",
      udf1: "cart-1",
      udf5: "test",
      surl: "https://api.example.test/garmops/payments/payu/callback",
      furl: "https://api.example.test/garmops/payments/payu/callback",
    })
    const fields = result.data?.fields as PayuRequestFields & { hash: string }
    expect(fields.hash).toBe(createPaymentRequestHash({ ...fields, salt: "secret" }))
  })
  it("does not authorize a session before a verified server event", async () => {
    const provider = new PayuPaymentProvider({}, { key: "merchant", salt: "secret" })
    expect((await provider.authorizePayment({ data: {} })).status).toBe("pending_authorization")
    expect((await provider.authorizePayment({ data: { verified: true, provider_status: "success" } })).status).toBe("captured")
  })
})
