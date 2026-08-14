import { createPaymentCollectionForCartWorkflow, createPaymentSessionsWorkflow } from "@medusajs/medusa/core-flows"
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export type InitiatePayuPaymentInput = {
  cartId: string
  customerId: string
  amountPaise: number
  data: Record<string, unknown>
}

export const initiatePayuPaymentWorkflow = createWorkflow("initiate-payu-payment", (input: InitiatePayuPaymentInput) => {
  const collection = createPaymentCollectionForCartWorkflow.runAsStep({ input: { cart_id: input.cartId, metadata: { garmops_authoritative_amount_paise: input.amountPaise, garmops_cart_type: input.data.cart_type } } })
  const session = createPaymentSessionsWorkflow.runAsStep({ input: { payment_collection_id: collection.id, provider_id: "pp_payu", customer_id: input.customerId, data: input.data } })
  return new WorkflowResponse(transform({ collectionId: collection.id, session }, ({ collectionId, session }) => ({ collectionId, session })))
})
