import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"

type Input = { email: string; requestId?: string }
const requestOtpStep = createStep("request-otp", async (input: Input, { container }) => {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const result = await service.createOtp(input.email, input.requestId)
  return new StepResponse(result, result.challenge.id)
}, async (challengeId, { container }) => {
  if (!challengeId) return
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  await service.deleteOtpChallenges(challengeId)
})

export const requestOtpWorkflow = createWorkflow("request-otp", (input: Input) => {
  const result = requestOtpStep(input)
  const notification = transform({ input, result }, ({ input, result }) => [{
    to: input.email.trim().toLowerCase(),
    channel: "email",
    template: "garmops-login-otp",
    content: {
      subject: "Your Garmops sign-in code",
      text: `Your Garmops sign-in code is ${result.code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5"><h2 style="margin:0 0 16px">Your Garmops sign-in code</h2><p>Use this code to sign in:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:20px 0">${result.code}</p><p>This code expires in 10 minutes.</p><p style="color:#666;font-size:13px">If you did not request this code, you can ignore this email.</p></div>`,
    },
    data: { expires_in_minutes: 10 },
    trigger_type: "garmops.customer.login_otp",
    resource_id: result.challenge.id,
    resource_type: "otp_challenge",
    idempotency_key: `garmops-login-otp:${result.challenge.id}`,
  }])
  sendNotificationsStep(notification)
  return new WorkflowResponse(result)
})
