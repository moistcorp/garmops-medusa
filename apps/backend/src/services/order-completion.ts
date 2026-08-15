import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { ICartModuleService, ILockingModule, INotificationModuleService, IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { completePayuOrderWorkflow } from "../workflows/complete-payu-order"
import { calculateGstBreakdown } from "../domain/pricing"
import { renderInvoicePdf, type InvoiceData } from "../domain/invoice"
import { putPrivateObject } from "../integrations/r2"
import { randomUUID } from "node:crypto"
import { injectTestFailure } from "../integrations/test-failures"
import { normalizeRequestedDeliveryDate } from "./garmops-cart"

type AddressLike = { first_name?: string; last_name?: string; company?: string; address_1?: string; address_2?: string; city?: string; postal_code?: string; province?: string; state?: string; metadata?: Record<string, unknown> }
type Container = MedusaContainer

function asPaise(value: unknown): number {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Order total is not an integer amount")
  return number
}

async function ensureOrderArtifacts(container: Container, input: { orderId: string; cartId: string; providerTransactionId: string; paymentId?: string }) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
  const order = await orderService.retrieveOrder(input.orderId, { relations: ["items", "billing_address", "shipping_address"] })
  const profile = (await service.listCartProfiles({ cart_id: input.cartId }))[0]
  if (!profile) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart profile is missing")
  const cart = await container.resolve<ICartModuleService>(Modules.CART).retrieveCart(input.cartId)
  const checkoutMetadata = (cart.metadata?.garmops_checkout ?? {}) as Record<string, unknown>
  const requestedDeliveryDate = normalizeRequestedDeliveryDate(checkoutMetadata.requestedDeliveryDate)
  const orderType = profile.cart_type
  const existingJob = (await service.listProductionJobs({ order_id: order.id }))[0]
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)
  const orderNumber = existingJob?.order_number ?? await locking.execute(`order-number:${orderType}:${new Date().getUTCFullYear()}`, () => service.issueOrderNumber(orderType), { timeout: 30 })
  if (!existingJob) await service.createProductionJobs({ order_id: order.id, order_number: orderNumber, order_type: orderType, status: "payment_confirmed", hold_from_status: null, requested_delivery_date: requestedDeliveryDate ?? null, artwork_review_status: "pending", tracking_number: null, tracking_url: null, metadata: { paymentTransactionId: input.providerTransactionId } })
  else if (!existingJob.requested_delivery_date && requestedDeliveryDate) await service.updateProductionJobs({ id: existingJob.id, requested_delivery_date: requestedDeliveryDate })
  if (!order.metadata?.garmops_order_number) await orderService.updateOrders([{ id: order.id, metadata: { ...(order.metadata ?? {}), garmops_order_number: orderNumber, garmops_order_type: orderType } }])

  const lines = await service.listConfiguredCartLines({ cart_id: input.cartId }, { order: { created_at: "ASC" } })
  const snapshots = await service.listOrderConfigurationSnapshots({ order_id: order.id })
  if (snapshots.length === 0 && lines.length > 0) {
    for (const [index, line] of lines.entries()) {
      const version = await service.retrieveDesignVersion(line.version_id)
      await service.createImmutableSnapshot({ orderId: order.id, productSlug: line.product_slug, quantity: line.quantity, sizeBreakdown: line.size_breakdown as Record<string, number>, snapshot: { configuration: version.configuration, deliveryType: line.delivery_type, requestedDeliveryDate, versionRevision: version.revision }, pricingSnapshot: (line.pricing_snapshot ?? {}) as Record<string, unknown>, lineItemId: line.line_item_id ?? undefined, lineNumber: index + 1, customerId: line.customer_id ?? undefined, projectId: line.project_id, versionId: line.version_id })
    }
  }
  const finalSnapshots = await service.listOrderConfigurationSnapshots({ order_id: order.id })
  await ensureInvoice(container, { order, orderNumber, orderType, snapshots: finalSnapshots, providerTransactionId: input.providerTransactionId, paymentId: input.paymentId })
  await ensureOrderNotification(container, order, orderNumber)
  return { order, orderNumber }
}

async function ensureInvoice(container: Container, input: { order: Awaited<ReturnType<IOrderModuleService["retrieveOrder"]>>; orderNumber: string; orderType: string; snapshots: Array<Record<string, unknown>>; providerTransactionId: string; paymentId?: string }) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const existing = (await service.listInvoices({ order_id: input.order.id }))[0]
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)
  const invoiceNumber = existing?.invoice_number ?? await locking.execute(`invoice-number:${new Date().getUTCFullYear()}`, () => service.issueInvoiceNumber(), { timeout: 30 })
  const sellerState = process.env.INVOICE_SELLER_STATE || ""
  const billing = (input.order.billing_address ?? {}) as AddressLike
  const buyerState = String(billing.province ?? billing.state ?? "") || null
  const items = input.order.items ?? []
  const lines: InvoiceData["lines"] = items.map((item) => ({ description: item.product_title || item.title, hsn: String(item.metadata?.hsn ?? "6109"), quantity: item.quantity, unitPaise: item.unit_price, discountPaise: Number(item.discount_total ?? 0), taxablePaise: Number(item.subtotal ?? item.unit_price * item.quantity) }))
  const totalPaise = asPaise(input.order.total)
  const computed = lines.reduce((sum, line) => sum + line.taxablePaise, 0)
  const gst = calculateGstBreakdown({ taxablePaise: computed, sellerState, buyerState })
  const accountingTotal = computed + gst.taxPaise
  if (accountingTotal !== totalPaise) throw new MedusaError(MedusaError.Types.CONFLICT, `Invoice total ${accountingTotal} does not reconcile to paid order total ${totalPaise}`)
  const data: InvoiceData = { invoiceNumber, invoiceDate: new Date().toISOString().slice(0, 10), orderNumber: input.orderNumber, seller: { name: process.env.INVOICE_SELLER_NAME || "Garmops", gstin: process.env.INVOICE_SELLER_GSTIN || "", address: process.env.INVOICE_SELLER_ADDRESS || "", state: sellerState, pin: process.env.INVOICE_SELLER_PIN }, buyer: { name: String(billing.first_name || input.order.email || "Customer") + (billing.last_name ? ` ${billing.last_name}` : ""), company: billing.company, gstin: billing.metadata?.gstin as string | undefined, address: [billing.address_1, billing.address_2, billing.city, billing.postal_code].filter(Boolean).join(", "), state: buyerState ?? undefined, pin: billing.postal_code }, shipping: input.order.shipping_address ? { address: [input.order.shipping_address.address_1, input.order.shipping_address.city, input.order.shipping_address.postal_code].filter(Boolean).join(", "), state: String(input.order.shipping_address.province ?? "") } : undefined, lines, payment: { provider: "PayU", reference: input.paymentId || input.providerTransactionId, status: "paid" } }
  const sellerSnapshot = data.seller
  const billingSnapshot = data.buyer
  const shippingSnapshot = data.shipping ?? null
  const paymentSnapshot = data.payment
  const invoice = existing ?? await service.createInvoices({ order_id: input.order.id, order_number: input.orderNumber, invoice_number: invoiceNumber, status: "pending", subtotal_paise: computed, tax_paise: gst.taxPaise, total_paise: totalPaise, cgst_paise: gst.cgstPaise, sgst_paise: gst.sgstPaise, igst_paise: gst.igstPaise, gst_rate_basis_points: 500, place_of_supply: gst.placeOfSupply, hsn_snapshot: { lines: lines.map((line) => ({ hsn: line.hsn, description: line.description })) }, seller_snapshot: sellerSnapshot, billing_snapshot: billingSnapshot, shipping_snapshot: shippingSnapshot, payment_snapshot: paymentSnapshot, pdf_file_id: null, issued_at: null, last_error: null })
  if (invoice.status === "issued" && invoice.pdf_file_id) return invoice
  try {
    injectTestFailure("invoice")
    const pdf = renderInvoicePdf(data)
    let fileId = invoice.pdf_file_id ?? randomUUID()
    const key = `garmops/invoices/${input.order.id}/${invoice.invoice_number}.pdf`
    await putPrivateObject({ key, body: pdf, contentType: "application/pdf", metadata: { "invoice-id": invoice.id, "order-id": input.order.id } })
    if (!invoice.pdf_file_id) {
      const existingFile = (await service.listStoredFiles({ object_key: key }))[0]
      if (existingFile) fileId = existingFile.id
      else await service.createStoredFiles({ id: fileId, object_key: key, bucket: process.env.R2_PRIVATE_BUCKET || "", purpose: "invoice", kind: "invoice", visibility: "private", original_filename: `${invoice.invoice_number}.pdf`, safe_filename: `${invoice.invoice_number}.pdf`, content_type: "application/pdf", extension: "pdf", byte_size: pdf.byteLength, sha256: null, uploaded_by: null, customer_id: input.order.customer_id ?? null, project_id: null, order_id: input.order.id, replacement_for_file_id: null, scan_status: "clean", state: "finalized", scan_attempts: 0, scan_started_at: new Date(), scan_completed_at: new Date(), scan_error: null, finalized_at: new Date(), metadata: { invoiceId: invoice.id } })
    }
    return service.updateInvoices({ id: invoice.id, status: "issued", pdf_file_id: fileId, issued_at: new Date(), last_error: null })
  } catch (error) {
    await service.updateInvoices({ id: invoice.id, status: "failed", last_error: error instanceof Error ? error.message : "Invoice PDF generation failed" })
    throw error
  }
}

async function ensureOrderNotification(container: Container, order: Awaited<ReturnType<IOrderModuleService["retrieveOrder"]>>, orderNumber: string) {
  if (!order.email) return
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const eventKey = `order-confirmed:${order.id}`
  const existing = (await service.listNotificationEvents({ event_key: eventKey }))[0]
  if (existing?.status === "sent") return
  const event = existing ?? await service.createNotificationEvents({ event_key: eventKey, channel: "email", template: "order-confirmed", recipient: order.email, status: "pending", payload: { orderId: order.id, orderNumber }, sent_at: null, last_error: null })
  try {
    const notification = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
    await notification.createNotifications({ to: order.email, channel: "email", template: "order-confirmed", data: { order_id: order.id, order_number: orderNumber }, idempotency_key: eventKey, trigger_type: "garmops.payment.confirmed", resource_id: order.id, resource_type: "order" })
    await service.updateNotificationEvents({ id: event.id, status: "sent", sent_at: new Date(), last_error: null })
  } catch (error) {
    await service.updateNotificationEvents({ id: event.id, status: "failed", last_error: error instanceof Error ? error.message : "Notification failed" })
    throw error
  }
}

export async function completeVerifiedPayuPayment(container: Container, input: { cartId: string; providerTransactionId: string; paymentId?: string }) {
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)
  return locking.execute(`payu:${input.providerTransactionId}`, async () => {
    const { result } = await completePayuOrderWorkflow(container).run({ input: { cartId: input.cartId } })
    return ensureOrderArtifacts(container, { orderId: result.id, cartId: input.cartId, providerTransactionId: input.providerTransactionId, paymentId: input.paymentId })
  }, { timeout: 30 })
}
