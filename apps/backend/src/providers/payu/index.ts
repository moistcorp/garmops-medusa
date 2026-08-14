import type { AuthorizePaymentInput, AuthorizePaymentOutput, CancelPaymentInput, CancelPaymentOutput, CapturePaymentInput, CapturePaymentOutput, DeletePaymentInput, DeletePaymentOutput, GetPaymentStatusInput, GetPaymentStatusOutput, InitiatePaymentInput, InitiatePaymentOutput, IPaymentProvider, ProviderWebhookPayload, RefundPaymentInput, RefundPaymentOutput, RetrievePaymentInput, RetrievePaymentOutput, UpdatePaymentInput, UpdatePaymentOutput, WebhookActionResult } from "@medusajs/framework/types"
import { MedusaError, ModuleProvider, Modules } from "@medusajs/framework/utils"
import { randomUUID } from "node:crypto"
import { formatPaiseAsRupees, createCommandHash, createPaymentRequestHash } from "./security"
import { testState } from "../../integrations/test-doubles"

type Options = { key?: string; salt?: string; environment?: "test" | "live"; callbackUrl?: string }
export class PayuPaymentProvider implements IPaymentProvider {
  static identifier = "payu"
  private readonly options: Options
  constructor(_container: Record<string, unknown>, options: Options = {}) { this.options = options }
  getIdentifier() { return PayuPaymentProvider.identifier }
  private get config() {
    const key = this.options.key ?? process.env.PAYU_KEY
    const salt = this.options.salt ?? process.env.PAYU_SALT
    if (!key || !salt) throw new MedusaError(MedusaError.Types.INVALID_DATA, "PayU is not configured")
    return { key, salt, environment: this.options.environment ?? process.env.PAYU_ENV ?? "test" as const }
  }
  private endpoint() { return this.config.environment === "live" ? "https://secure.payu.in/merchant/postservice.php?form=2" : "https://test.payu.in/merchant/postservice.php?form=2" }
  private async command(command: string, variable: string, amount?: string) {
    const { key, salt } = this.config
    const response = await fetch(this.endpoint(), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ key, command, var1: variable, ...(amount ? { amount } : {}), hash: createCommandHash(key, command, variable, salt) }) })
    if (!response.ok) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `PayU ${command} request failed`)
    const body = await response.json() as Record<string, unknown>
    return body
  }
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    if (input.currency_code.toLowerCase() !== "inr") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "PayU only supports INR")
    const data = input.data ?? {}
    const txnid = String(data.txnid ?? `garmops-${randomUUID()}`)
    const { key, salt, environment } = this.config
    const amount = formatPaiseAsRupees(Number(input.amount))
    const firstname = String(input.context?.customer?.first_name ?? "Customer")
    const email = String(input.context?.customer?.email ?? data.email ?? "")
    const productinfo = String(data.productinfo ?? "Garmops order").slice(0, 200)
    const fields = { key, txnid, amount, productinfo, firstname, email, udf1: String(data.cart_id ?? ""), udf5: environment, hash: createPaymentRequestHash({ key, txnid, amount, productinfo, firstname, email, udf1: String(data.cart_id ?? ""), salt }) }
    return { id: txnid, status: "pending", data: { provider: "payu", environment, checkoutUrl: environment === "live" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment", fields } }
  }
  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> { return { status: "pending", data: { ...(input.data ?? {}), amount: String(input.amount), currency_code: input.currency_code } } }
  async deletePayment(_input: DeletePaymentInput): Promise<DeletePaymentOutput> { return {} }
  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    if (input.data?.verified !== true) return { status: "pending_authorization", data: { reason: "Awaiting verified PayU callback" } }
    if (input.data?.provider_status !== "success") return { status: "error", data: { reason: "PayU did not report success" } }
    return { status: "captured", data: { mihpayid: input.data.mihpayid, verified_at: input.data.verified_at } }
  }
  async capturePayment(_input: CapturePaymentInput): Promise<CapturePaymentOutput> { return {} }
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const txnid = String(input.data?.mihpayid ?? input.data?.txnid ?? "")
    if (!txnid) throw new MedusaError(MedusaError.Types.INVALID_DATA, "PayU refund is missing transaction identity")
    if (process.env.NODE_ENV !== "production" && process.env.GARMOPS_TEST_DOUBLES === "true") {
      testState().paymentCommands.push({ command: "cancel_refund_transaction", txnid, amount: input.amount })
      return { data: { amount: formatPaiseAsRupees(input.amount), status: "refund_requested", provider_response: { status: "1", test: true } } }
    }
    const result = await this.command("cancel_refund_transaction", txnid, formatPaiseAsRupees(input.amount))
    if (String(result.status) !== "1") throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "PayU rejected the refund request")
    return { data: { amount: formatPaiseAsRupees(input.amount), status: "refund_requested", provider_response: result } }
  }
  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> { return { data: { ...(input.data ?? {}), ...(await this.command("verify_payment", String(input.data?.txnid ?? input.data?.mihpayid ?? ""))) } } }
  async cancelPayment(_input: CancelPaymentInput): Promise<CancelPaymentOutput> { return {} }
  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    if (input.data?.verified === true && input.data?.provider_status === "success") return { status: "authorized" }
    if (["failure", "failed", "cancelled", "canceled"].includes(String(input.data?.provider_status))) return { status: "canceled" }
    return { status: "pending_authorization" }
  }
  async getWebhookActionAndData(data: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const fields = data as Record<string, unknown>
    const status = String(fields.status ?? "").toLowerCase()
    const action = status === "success" ? "authorized" : ["failure", "failed", "cancelled", "canceled"].includes(status) ? "failed" : "pending_authorization"
    return { action, data: fields.session_id ? { session_id: String(fields.session_id), amount: Number(fields.amount ?? 0) } : undefined }
  }
}

export default ModuleProvider(Modules.PAYMENT, { services: [PayuPaymentProvider] })
