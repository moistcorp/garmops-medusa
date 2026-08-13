import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"

type Input = { email: string; requestId?: string }
const requestOtpStep = createStep("garmops-request-otp", async (input: Input, { container }) => {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const result = await service.createOtp(input.email, input.requestId)
  return new StepResponse(result, result.challenge.id)
}, async (challengeId, { container }) => {
  if (!challengeId) return
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  await service.deleteOtpChallenges(challengeId)
})

export const requestOtpWorkflow = createWorkflow("garmops-request-otp", (input: Input) => new WorkflowResponse(requestOtpStep(input)))
