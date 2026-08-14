import { acquireLockStep, completeCartWorkflow, releaseLockStep } from "@medusajs/medusa/core-flows"
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const completePayuOrderWorkflow = createWorkflow("complete-payu-order", (input: { cartId: string }) => {
  acquireLockStep({ key: input.cartId, timeout: 30, ttl: 120 })
  const order = completeCartWorkflow.runAsStep({ input: { id: input.cartId } })
  releaseLockStep({ key: input.cartId })
  return new WorkflowResponse(order)
})
