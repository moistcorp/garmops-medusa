import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createHash, timingSafeEqual } from "node:crypto"
import { GARMOPS_MODULE } from "../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../modules/garmops/service"
import { Modules } from "@medusajs/framework/utils"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as Record<string, unknown>
  const challengeId = String(body.challengeId ?? "")
  const code = String(body.code ?? "")
  if (!challengeId || !/^\d{6}$/.test(code)) return res.status(400).json({ code: "INVALID_OTP", message: "The code is invalid or expired" })
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const challenge = await service.retrieveOtpChallenge(challengeId)
  if (challenge.consumed || new Date(challenge.expires_at).getTime() < Date.now() || challenge.attempts >= 5) return res.status(400).json({ code: "INVALID_OTP", message: "The code is invalid or expired" })
  const expected = Buffer.from(challenge.code_hash, "hex")
  const supplied = createHash("sha256").update(code).digest()
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    await service.updateOtpChallenges({ id: challenge.id, attempts: challenge.attempts + 1 })
    return res.status(400).json({ code: "INVALID_OTP", message: "The code is invalid or expired" })
  }
  await service.updateOtpChallenges({ id: challenge.id, consumed: true })
  const customerService = req.scope.resolve(Modules.CUSTOMER)
  const existing = await customerService.listCustomers({ email: challenge.email })
  const customer = existing[0] ?? await customerService.createCustomers({ email: challenge.email, metadata: { authSource: "email_otp" } })
  res.json({ customer, verified: true })
}
