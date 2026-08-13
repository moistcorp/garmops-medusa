import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createHash } from "node:crypto"
import { GARMOPS_MODULE } from "../../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../../modules/garmops/service"
import { parseRupeesToPaise, paymentEventFingerprint, verifyPaymentResponseHash, type PayuFields } from "../../../../../../providers/payu/security"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fields = req.body as Partial<PayuFields> & Record<string, unknown>
  const salt = process.env.PAYU_SALT
  if (!salt || !fields.key || fields.key !== process.env.PAYU_KEY || !fields.txnid || !fields.status || !fields.hash) return res.status(400).json({ code: "INVALID_PAYU_CALLBACK", message: "Required PayU fields are missing", requestId: req.requestId })
  if (!verifyPaymentResponseHash(fields as PayuFields, salt)) return res.status(400).json({ code: "INVALID_PAYU_HASH", message: "PayU response signature is invalid", requestId: req.requestId })
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const payloadHash = createHash("sha256").update(JSON.stringify(fields)).digest("hex")
  const recorded = await service.recordPaymentEvent({ providerEventId: paymentEventFingerprint("payu-callback", fields), paymentId: String(fields.mihpayid ?? fields.txnid), cartId: typeof fields.udf1 === "string" ? fields.udf1 : undefined, eventType: "callback", status: String(fields.status), amountPaise: parseRupeesToPaise(fields.amount) ?? undefined, payloadHash })
  res.json({ accepted: true, verified: true, duplicate: recorded.duplicate, status: fields.status, requestId: req.requestId })
}
