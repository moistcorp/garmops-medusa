import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { verifyGarmopsOtpWorkflow } from "../../../../../workflows/garmops-mutations"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as Record<string, unknown>
  const challengeId = String(body.challengeId ?? "")
  const code = String(body.code ?? "")
  if (!challengeId || !/^\d{6}$/.test(code)) return res.status(400).json({ code: "INVALID_OTP", message: "The code is invalid or expired" })
  try {
    const { result: customer } = await verifyGarmopsOtpWorkflow(req.scope).run({ input: { challengeId, code } })
    res.json({ customer, verified: true })
  } catch {
    res.status(400).json({ code: "INVALID_OTP", message: "The code is invalid or expired" })
  }
}
