import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

/**
 * Converts a cart into an order for a verified PayU payment.
 *
 * Callers MUST already hold the canonical cart critical section
 * (`cart:<cartId>`, see `withCartLock`) before running this workflow. It
 * intentionally does not acquire that lock itself so that payment callbacks can
 * verify the cart revision and complete the order inside a single critical
 * section without a nested (non-reentrant) acquisition.
 */
export const completePayuOrderWorkflow = createWorkflow("complete-payu-order", (input: { cartId: string }) => {
  const order = completeCartWorkflow.runAsStep({ input: { id: input.cartId } })
  return new WorkflowResponse(order)
})