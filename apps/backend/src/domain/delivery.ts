import { MedusaError } from "@medusajs/framework/utils"

export type DeliveryType = "rush" | "standard" | "flexible"
export const BUSINESS_TIME_ZONE = "Asia/Kolkata"
export const STANDARD_LEAD_TIME_DAYS = 35
export const RUSH_LEAD_TIME_DAYS = 18
export const CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS = 15

function indiaDateParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
  const values = Object.fromEntries(parts.filter((part) => ["year", "month", "day"].includes(part.type)).map((part) => [part.type, Number(part.value)]))
  return { year: values.year, month: values.month, day: values.day }
}

function dateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { year, month, day } : null
}

function toUtcDate(value: { year: number; month: number; day: number }): Date { return new Date(Date.UTC(value.year, value.month - 1, value.day)) }
function iso(value: { year: number; month: number; day: number }): string { return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}` }

function addWorkingDays(start: { year: number; month: number; day: number }, days: number): string {
  const result = toUtcDate(start)
  let counted = 0
  while (counted < days) {
    result.setUTCDate(result.getUTCDate() + 1)
    if (result.getUTCDay() !== 0) counted += 1
  }
  return iso({ year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: result.getUTCDate() })
}

export function deliveryDateOptions(now = new Date(), extraLeadTimeDays = 0): { earliestRushDate: string; earliestStandardDate: string; earliestFlexibleDate: string } {
  const today = indiaDateParts(now)
  const rush = addWorkingDays(today, RUSH_LEAD_TIME_DAYS + extraLeadTimeDays)
  const standard = addWorkingDays(today, STANDARD_LEAD_TIME_DAYS + extraLeadTimeDays)
  return { earliestRushDate: rush, earliestStandardDate: standard, earliestFlexibleDate: standard }
}

export function validateDeliveryDate(input: { deliveryType?: string; requestedDeliveryDate?: string; now?: Date; extraLeadTimeDays?: number }): string | undefined {
  if (!input.requestedDeliveryDate && !input.deliveryType) return undefined
  const deliveryType = input.deliveryType
  if (!["rush", "standard", "flexible"].includes(String(deliveryType))) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Delivery preference is invalid")
  const requested = input.requestedDeliveryDate ? dateOnly(input.requestedDeliveryDate) : null
  if (!requested) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Requested delivery date must be a valid calendar date")
  const options = deliveryDateOptions(input.now, input.extraLeadTimeDays ?? 0)
  const requestedIso = iso(requested)
  const valid = deliveryType === "rush" ? requestedIso === options.earliestRushDate : deliveryType === "standard" ? requestedIso === options.earliestStandardDate : requestedIso >= options.earliestFlexibleDate
  if (!valid) throw new MedusaError(MedusaError.Types.CONFLICT, `Requested ${deliveryType} delivery date is no longer available; choose a date allowed by the current production lead time`)
  return requestedIso
}

export function extraLeadTimeForConfiguration(configuration: unknown): number {
  const record = configuration && typeof configuration === "object" && !Array.isArray(configuration) ? configuration as Record<string, unknown> : {}
  const colour = record.colour && typeof record.colour === "object" ? record.colour as Record<string, unknown> : {}
  return record.colourType === "custom_dye" || colour.type === "custom_dye" ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS : 0
}
