import type { ICacheService, ILockingModule } from "@medusajs/framework/types"
import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"

type TurnstileResponse = { success?: boolean; hostname?: string; action?: string; challenge_ts?: string; [key: string]: unknown }

function testBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.TURNSTILE_BYPASS_FOR_TESTS === "true" && process.env.GARMOPS_TEST_DOUBLES === "true"
}

export function requestIp(req: MedusaRequest): string {
  const forwarded = req.get("x-forwarded-for")?.split(",")[0]?.trim()
  return (forwarded || req.ip || req.get("x-real-ip") || "unknown").slice(0, 128)
}

export async function verifyTurnstile(req: MedusaRequest, token: string | undefined): Promise<void> {
  if (testBypassEnabled()) return
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret || !token?.trim()) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Verification could not be completed")
  const body = new URLSearchParams({ secret, response: token.trim(), remoteip: requestIp(req) })
  let result: TurnstileResponse
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body })
    result = await response.json() as TurnstileResponse
  } catch {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Verification is temporarily unavailable")
  }
  if (result.success !== true) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Verification could not be completed")
  const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME?.trim()
  const expectedAction = process.env.TURNSTILE_EXPECTED_ACTION?.trim() || "login"
  if (expectedHostname && result.hostname !== expectedHostname) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Verification could not be completed")
  if (expectedAction && result.action && result.action !== expectedAction) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Verification could not be completed")
  if (result.challenge_ts && Date.now() - Date.parse(result.challenge_ts) > 5 * 60_000) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Verification expired; try again")
}

function limit(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

export async function enforceLoginRateLimits(req: MedusaRequest, email: string): Promise<void> {
  const cache = req.scope.resolve<ICacheService>(Modules.CACHE)
  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)
  const ip = requestIp(req)
  const windowSeconds = 10 * 60
  const keys = [
    { key: `garmops:login:email:${createHash("sha256").update(email).digest("hex")}`, max: limit("LOGIN_EMAIL_LIMIT", 10) },
    { key: `garmops:login:ip:${createHash("sha256").update(ip).digest("hex")}`, max: limit("LOGIN_IP_LIMIT", 50) },
    { key: `garmops:login:pair:${createHash("sha256").update(`${ip}:${email}`).digest("hex")}`, max: limit("LOGIN_IP_EMAIL_LIMIT", 10) },
    { key: "garmops:login:global", max: limit("LOGIN_GLOBAL_LIMIT", 1000) },
  ]
  await locking.execute("login-rate-global", async () => {
    for (const item of keys) {
      const current = Number(await cache.get<number>(item.key) ?? 0)
      if (current >= item.max) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Too many sign-in attempts; try again later")
    }
    await Promise.all(keys.map(async (item) => {
      const current = Number(await cache.get<number>(item.key) ?? 0)
      await cache.set(item.key, current + 1, windowSeconds)
    }))
  }, { timeout: 10 })
}

export async function enforceOtpRateLimits(req: MedusaRequest, email: string): Promise<void> {
  const cache = req.scope.resolve<ICacheService>(Modules.CACHE)
  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)
  const ip = requestIp(req)
  const windowSeconds = 10 * 60
  const keys = [
    { key: `garmops:otp:email:${createHash("sha256").update(email).digest("hex")}`, max: limit("OTP_EMAIL_LIMIT", 5) },
    { key: `garmops:otp:ip:${createHash("sha256").update(ip).digest("hex")}`, max: limit("OTP_IP_LIMIT", 20) },
    { key: `garmops:otp:pair:${createHash("sha256").update(`${ip}:${email}`).digest("hex")}`, max: limit("OTP_IP_EMAIL_LIMIT", 5) },
    { key: "garmops:otp:global", max: limit("OTP_GLOBAL_LIMIT", 500) },
  ]
  // A single short Redis-backed critical section makes the global bucket and
  // the scoped buckets race-safe across all backend instances.
  await locking.execute("otp-rate-global", async () => {
    for (const item of keys) {
      const current = Number(await cache.get<number>(item.key) ?? 0)
      if (current >= item.max) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Too many sign-in requests; try again later")
    }
    await Promise.all(keys.map(async (item) => {
      const current = Number(await cache.get<number>(item.key) ?? 0)
      await cache.set(item.key, current + 1, windowSeconds)
    }))
  }, { timeout: 10 })
}
