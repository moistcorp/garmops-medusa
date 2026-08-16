import { createHash, timingSafeEqual } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { formatMedusaAmountForPayu, medusaAmountToPaise } from "../../domain/money"

export function parsePaiseAmount(value: unknown): number | null {
  let candidate = value
  if (candidate && typeof candidate === "object") {
    const record = candidate as Record<string, unknown>
    candidate = record.raw ?? record
    if (candidate && typeof candidate === "object") candidate = (candidate as Record<string, unknown>).value
  }
  const paise = typeof candidate === "number" ? candidate : typeof candidate === "string" && candidate.trim() ? Number(candidate) : NaN
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null
}
export function formatPaiseAsRupees(paise: unknown): string {
  const parsedPaise = parsePaiseAmount(paise)
  if (parsedPaise === null) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid paise amount")
  return `${Math.floor(parsedPaise / 100)}.${String(parsedPaise % 100).padStart(2, "0")}`
}
export { formatMedusaAmountForPayu, medusaAmountToPaise }
export function parseRupeesToPaise(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(String(value).trim())
  if (!match) return null
  const paise = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"))
  return Number.isSafeInteger(paise) ? paise : null
}
export type PayuRequestFields = { key: string; txnid: string; amount: string; productinfo: string; firstname: string; email: string; phone?: string; udf1?: string; udf2?: string; udf3?: string; udf4?: string; udf5?: string; surl?: string; furl?: string }
export function createPaymentRequestHash(input: PayuRequestFields & { salt: string }): string {
  return createHash("sha512").update([input.key, input.txnid, input.amount, input.productinfo, input.firstname, input.email, input.udf1 ?? "", input.udf2 ?? "", input.udf3 ?? "", input.udf4 ?? "", input.udf5 ?? "", "", "", "", "", "", input.salt].join("|")).digest("hex")
}
export type PayuFields = { key: string; txnid: string; amount: string; productinfo: string; firstname: string; email: string; udf1?: string; udf2?: string; udf3?: string; udf4?: string; udf5?: string; status: string; hash: string; mihpayid?: string; unmappedstatus?: string; additional_charges?: string; additionalCharges?: string; splitInfo?: string }
export function verifyPaymentResponseHash(fields: PayuFields, salt: string): boolean {
  const parts = fields.splitInfo ? [salt, fields.status, fields.splitInfo, "", "", "", "", "", fields.udf5 ?? "", fields.udf4 ?? "", fields.udf3 ?? "", fields.udf2 ?? "", fields.udf1 ?? "", fields.email, fields.firstname, fields.productinfo, fields.amount, fields.txnid, fields.key] : [salt, fields.status, "", "", "", "", "", fields.udf5 ?? "", fields.udf4 ?? "", fields.udf3 ?? "", fields.udf2 ?? "", fields.udf1 ?? "", fields.email, fields.firstname, fields.productinfo, fields.amount, fields.txnid, fields.key]
  const additional = fields.additional_charges ?? fields.additionalCharges
  if (additional) parts.unshift(additional)
  const expected = createHash("sha512").update(parts.join("|")).digest("hex")
  const supplied = fields.hash.toLowerCase()
  if (!/^[a-f0-9]{128}$/.test(supplied)) return false
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"))
}
export function createCommandHash(key: string, command: string, variable: string, salt: string): string { return createHash("sha512").update(`${key}|${command}|${variable}|${salt}`).digest("hex") }
export function paymentEventFingerprint(source: string, fields: Record<string, unknown>): string { return createHash("sha256").update(`${source}|${Object.keys(fields).sort().map((key) => `${key}=${String(fields[key] ?? "")}`).join("&")}`).digest("hex") }
