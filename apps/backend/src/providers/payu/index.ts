import type { AuthorizePaymentInput, AuthorizePaymentOutput, CancelPaymentInput, CancelPaymentOutput, CapturePaymentInput, CapturePaymentOutput, DeletePaymentInput, DeletePaymentOutput, GetPaymentStatusInput, GetPaymentStatusOutput, InitiatePaymentInput, InitiatePaymentOutput, IPaymentProvider, ProviderWebhookPayload, RefundPaymentInput, RefundPaymentOutput, RetrievePaymentInput, RetrievePaymentOutput, UpdatePaymentInput, UpdatePaymentOutput, WebhookActionResult } from "@medusajs/framework/types"
import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { formatPaiseAsRupees, createPaymentRequestHash } from "./security"

type Options = { key?: string; salt?: string; environment?: "test" | "live"; callbackUrl?: string }
export class PayuPaymentProvider implements IPaymentProvider {
  static identifier = "payu"
  private readonly options: Options
  constructor(_container: Record<string, unknown>, options: Options = {}) { this.options = options }
  getIdentifier() { return PayuPaymentProvider.identifier }
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    if (input.currency_code.toLowerCase() !== "inr") throw new Error("PayU only supports INR")
    const data = input.data ?? {}
    const txnid = String(data.txnid ?? `garmops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    const key = this.options.key ?? process.env.PAYU_KEY
    const salt = this.options.salt ?? process.env.PAYU_SALT
    const amount = formatPaiseAsRupees(Math.round(Number(input.amount) * 100))
    const firstname = String(input.context?.customer?.first_name ?? "Customer")
    const email = String(input.context?.customer?.email ?? data.email ?? "")
    const productinfo = String(data.productinfo ?? "Garmops order").slice(0, 200)
    const fields = key && salt ? { key, txnid, amount, productinfo, firstname, email, udf1: String(data.cart_id ?? ""), hash: createPaymentRequestHash({ key, txnid, amount, productinfo, firstname, email, salt }) } : undefined
    return { id: txnid, status: "pending", data: { provider: "payu", environment: this.options.environment ?? process.env.PAYU_ENV ?? "test", checkoutUrl: this.options.environment === "live" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment", fields } }
  }
  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> { return { data: { amount: String(input.amount), currency_code: input.currency_code } } }
  async deletePayment(_input: DeletePaymentInput): Promise<DeletePaymentOutput> { return {} }
  async authorizePayment(_input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> { return { status: "authorized" } }
  async capturePayment(_input: CapturePaymentInput): Promise<CapturePaymentOutput> { return {} }
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> { return { data: { amount: String(input.amount), status: "refund_requested", requiresProviderConfirmation: true } } }
  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> { return { data: input.data ?? {} } }
  async cancelPayment(_input: CancelPaymentInput): Promise<CancelPaymentOutput> { return {} }
  async getPaymentStatus(_input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> { return { status: "pending" } }
  async getWebhookActionAndData(_data: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> { return { action: "pending" } }
}

export default ModuleProvider(Modules.PAYMENT, { services: [PayuPaymentProvider] })
