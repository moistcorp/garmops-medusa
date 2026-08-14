import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { invoiceDownload } from "../../../../../services/customer-orders"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  try { const result = await invoiceDownload(req.scope, req.params.id, customerId); return res.json({ invoice: { id: result.invoice.id, invoiceNumber: result.invoice.invoice_number, status: result.invoice.status, issuedAt: result.invoice.issued_at }, url: result.url, expiresIn: result.expiresIn, requestId: req.requestId }) } catch (error) { return res.status(404).json({ code: "INVOICE_NOT_FOUND", message: error instanceof Error ? error.message : "Invoice not found", requestId: req.requestId }) }
}
