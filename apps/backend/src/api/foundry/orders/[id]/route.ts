import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules, remoteQueryObjectFromString } from "@medusajs/framework/utils"
import { GARMOPS_MODULE } from "../../../../modules/garmops"
import type GarmopsModuleService from "../../../../modules/garmops/service"
import { hasStaffPermission } from "../../../../auth/staff"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "view_all_orders"))) return res.status(403).json({ code: "FORBIDDEN", message: "Active staff role required", requestId: req.requestId })
  try {
    const job = await service.retrieveProductionJob(req.params.id)
    const order = await req.scope.resolve<any>(Modules.ORDER).retrieveOrder(job.order_id, { relations: ["items", "billing_address", "shipping_address"] })
    const remoteQuery = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
    const orderGraph = await remoteQuery(remoteQueryObjectFromString({ entryPoint: "order", variables: { filters: { id: order.id } }, fields: ["id", "payment_collections.payments.id", "payment_collections.payments.provider_id"] }))
    const snapshots = await service.listOrderConfigurationSnapshots({ order_id: order.id }, { order: { line_number: "ASC" } })
    const artworkFileIds = new Set<string>()
    for (const snapshot of snapshots) {
      const configuration = (snapshot.snapshot as Record<string, unknown> | null)?.configuration as Record<string, unknown> | undefined
      const artwork = configuration?.artwork as Record<string, unknown> | undefined
      for (const value of [artwork?.front, artwork?.back, configuration?.neckLabel]) {
        const fileId = value && typeof value === "object" ? (value as Record<string, unknown>).fileId : undefined
        if (typeof fileId === "string") artworkFileIds.add(fileId)
      }
    }
    const artworkFiles = await Promise.all(Array.from(artworkFileIds).map(async (fileId) => {
      try {
        const file = await service.retrieveStoredFile(fileId)
        return { id: file.id, scanStatus: file.scan_status, state: file.state }
      } catch { return null }
    }))
    const invoice = (await service.listInvoices({ order_id: order.id }))[0]
    const paymentCollections = orderGraph[0]?.payment_collections ?? []
    const payment = paymentCollections.flatMap((collection: { payments?: Array<{ id: string; provider_id?: string }> }) => collection.payments ?? []).find((candidate: { provider_id?: string }) => candidate.provider_id === "pp_payu") ?? paymentCollections.flatMap((collection: { payments?: Array<{ id: string; provider_id?: string }> }) => collection.payments ?? [])[0]
    const safeOrder = order
    return res.json({ order: { ...safeOrder, payment: payment ? { id: payment.id } : null }, job, snapshots, artworkFiles: artworkFiles.filter(Boolean), invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoice_number, status: invoice.status } : null, requestId: req.requestId })
  } catch (error) { return res.status(404).json({ code: "ORDER_NOT_FOUND", message: error instanceof Error ? error.message : "Order not found", requestId: req.requestId }) }
}
