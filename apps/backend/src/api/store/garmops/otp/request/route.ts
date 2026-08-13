import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requestOtpWorkflow } from "../../../../../workflows/request-otp"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const email = String((req.body as Record<string, unknown>).email ?? "").trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ code: "INVALID_EMAIL", message: "Enter a valid email address" })
  const { result } = await requestOtpWorkflow(req.scope).run({ input: { email, requestId: req.get("x-request-id") ?? undefined } })
  const response: Record<string, unknown> = { accepted: true, challengeId: result.challenge.id }
  if (process.env.NODE_ENV !== "production" && process.env.EXPOSE_TEST_OTP === "true") response.testCode = result.code
  res.status(202).json(response)
}
