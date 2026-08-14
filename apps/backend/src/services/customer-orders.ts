import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { PUBLIC_STATUS_BY_INTERNAL, type OrderStatus } from "../domain/production"
import { createSignedDownload } from "../integrations/r2"

type Scope = Pick<MedusaContainer, "resolve">

function orders(scope: Scope) { return scope.resolve<IOrderModuleService>(Modules.ORDER) }
function garmops(scope: Scope) { return scope.resolve<GarmopsModuleService>(GARMOPS_MODULE) }

export async function findOwnedOrder(scope: Scope, idOrNumber: string, customerId: string) {
  const orderService = orders(scope)
  const jobs = await garmops(scope).listProductionJobs({ order_number: idOrNumber })
  const orderId = jobs[0]?.order_id ?? idOrNumber
  const order = await orderService.retrieveOrder(orderId, { relations: ["items", "billing_address", "shipping_address"] })
  if (order.customer_id !== customerId) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  return order
}

export async function customerOrderView(scope: Scope, order: Awaited<ReturnType<IOrderModuleService["retrieveOrder"]>>) {
  const service = garmops(scope)
  const job = (await service.listProductionJobs({ order_id: order.id }))[0]
  const snapshots = await service.listOrderConfigurationSnapshots({ order_id: order.id }, { order: { line_number: "ASC" } })
  const invoice = (await service.listInvoices({ order_id: order.id }))[0]
  const internal = job?.status as OrderStatus | undefined
  return {
    id: order.id,
    publicOrderNumber: job?.order_number ?? order.metadata?.garmops_order_number ?? null,
    type: job?.order_type ?? order.metadata?.garmops_order_type ?? "configured",
    date: order.created_at,
    email: order.email,
    items: order.items ?? [],
    totalPaise: Number(order.total),
    paymentState: job ? "paid" : "pending",
    productionStatus: internal ? PUBLIC_STATUS_BY_INTERNAL[internal] : "payment_pending",
    requestedDeliveryDate: job?.requested_delivery_date ?? null,
    tracking: job?.tracking_number ? { number: job.tracking_number, url: job.tracking_url } : null,
    shippingAddress: order.shipping_address,
    billingAddress: order.billing_address,
    snapshots,
    invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoice_number, status: invoice.status, issuedAt: invoice.issued_at, downloadable: Boolean(invoice.pdf_file_id) } : null,
  }
}

export async function invoiceDownload(scope: Scope, invoiceId: string, customerId: string) {
  const invoice = await garmops(scope).retrieveInvoice(invoiceId)
  const order = await orders(scope).retrieveOrder(invoice.order_id)
  if (order.customer_id !== customerId || !invoice.pdf_file_id) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Invoice not found")
  const file = await garmops(scope).retrieveStoredFile(invoice.pdf_file_id)
  if (file.order_id !== order.id || file.visibility !== "private" || file.state !== "finalized") throw new MedusaError(MedusaError.Types.NOT_FOUND, "Invoice not found")
  return { invoice, url: await createSignedDownload(file.object_key), expiresIn: 300 }
}

