import { createHash } from "node:crypto"

export const CURRENT_TERMS_VERSION = process.env.GARMOPS_CURRENT_TERMS_VERSION?.trim() || "full-payment-v1-2026-08-04"
export const CURRENT_PRIVACY_VERSION = process.env.GARMOPS_CURRENT_PRIVACY_VERSION?.trim() || "privacy-v1-2026-08-04"
export const CURRENT_TERMS_CONTENT_HASH = process.env.GARMOPS_CURRENT_TERMS_CONTENT_HASH?.trim() || "7a1cfcabf3abf70a60fb2f2191a63941151c1041f42ea2f1dcf7f8aa9506825c"
export const CURRENT_PRIVACY_CONTENT_HASH = process.env.GARMOPS_CURRENT_PRIVACY_CONTENT_HASH?.trim() || null

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`
}

export function fingerprint(value: unknown): string { return createHash("sha256").update(canonicalJson(value)).digest("hex") }
