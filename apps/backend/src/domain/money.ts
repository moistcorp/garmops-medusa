import { MedusaError } from "@medusajs/framework/utils"

/** Garmops pricing and financial snapshots are always integer paise. */
export function assertPaise(value: unknown, field = "Amount"): number {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${field} must be a non-negative paise integer`)
  return amount
}

/** Convert Garmops paise to the major-unit number expected by native Medusa money fields. */
export function paiseToMedusaAmount(value: unknown, field = "Amount"): number {
  const paise = assertPaise(value, field)
  const amount = paise / 100
  if (!Number.isSafeInteger(paise) || !Number.isFinite(amount)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${field} is outside the supported monetary range`)
  return amount
}

/** Convert a native Medusa major-unit amount back to an exact Garmops paise integer. */
export function medusaAmountToPaise(value: unknown, field = "Amount"): number {
  let candidate = value
  if (candidate && typeof candidate === "object") {
    const record = candidate as Record<string, unknown>
    candidate = record.raw ?? record.value ?? record
    if (candidate && typeof candidate === "object") candidate = (candidate as Record<string, unknown>).value ?? (candidate as Record<string, unknown>).raw
  }
  const amount = Number(candidate)
  if (!Number.isFinite(amount) || amount < 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${field} must be a non-negative currency amount`)
  const paise = Math.round(amount * 100)
  if (!Number.isSafeInteger(paise)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${field} is outside the supported monetary range`)
  return paise
}

export function formatMedusaAmountForPayu(value: unknown): string {
  return (medusaAmountToPaise(value) / 100).toFixed(2)
}
