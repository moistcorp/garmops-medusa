import { calculateGstBreakdown } from "./pricing"

export type InvoiceLine = {
  description: string
  hsn: string
  quantity: number
  unitPaise: number
  discountPaise: number
  taxablePaise: number
}

export type InvoiceData = {
  invoiceNumber: string
  invoiceDate: string
  orderNumber: string
  seller: { name: string; gstin: string; address: string; state: string; pin?: string }
  buyer: { name: string; company?: string; gstin?: string; address: string; state?: string; pin?: string }
  shipping?: { name?: string; address?: string; state?: string; pin?: string }
  lines: InvoiceLine[]
  payment?: { provider: string; reference?: string; status: string }
}

export function calculateInvoiceTotals(data: InvoiceData) {
  const subtotalPaise = data.lines.reduce((sum, line) => sum + line.taxablePaise, 0)
  const gst = calculateGstBreakdown({ taxablePaise: subtotalPaise, sellerState: data.seller.state, buyerState: data.buyer.state })
  return { subtotalPaise, ...gst, totalPaise: subtotalPaise + gst.taxPaise }
}

function pdfEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").replaceAll(/[\r\n]+/g, " ")
}

/** A deterministic, dependency-free PDF that works in the Linux production image. */
export function renderInvoicePdf(data: InvoiceData): Buffer {
  const totals = calculateInvoiceTotals(data)
  const lines: string[] = [
    "BT /F1 18 Tf 50 800 Td (GARMOPS - TAX INVOICE) Tj",
    `/F1 10 Tf 0 -26 Td (Invoice: ${pdfEscape(data.invoiceNumber)}    Date: ${pdfEscape(data.invoiceDate)}) Tj`,
    `0 -16 Td (Order: ${pdfEscape(data.orderNumber)}) Tj`,
    `0 -26 Td (${pdfEscape(data.seller.name)} | GSTIN: ${pdfEscape(data.seller.gstin)}) Tj`,
    `0 -14 Td (${pdfEscape(data.seller.address)} | ${pdfEscape(data.seller.state)} ${pdfEscape(data.seller.pin ?? "")}) Tj`,
    `0 -26 Td (Bill to: ${pdfEscape(data.buyer.name)} ${pdfEscape(data.buyer.company ?? "")}) Tj`,
    `0 -14 Td (${pdfEscape(data.buyer.address)} | ${pdfEscape(data.buyer.state ?? "")} ${pdfEscape(data.buyer.pin ?? "")}) Tj`,
    `0 -30 Td (Description                         HSN       Qty       Taxable) Tj`,
  ]
  for (const line of data.lines) lines.push(`0 -16 Td (${pdfEscape(line.description).slice(0, 52)}  ${pdfEscape(line.hsn)}  ${line.quantity}  Rs ${(line.taxablePaise / 100).toFixed(2)}) Tj`)
  lines.push(`0 -30 Td (Subtotal: Rs ${(totals.subtotalPaise / 100).toFixed(2)}) Tj`)
  lines.push(`0 -16 Td (CGST: Rs ${(totals.cgstPaise / 100).toFixed(2)}  SGST: Rs ${(totals.sgstPaise / 100).toFixed(2)}  IGST: Rs ${(totals.igstPaise / 100).toFixed(2)}) Tj`)
  lines.push(`0 -20 Td (Grand total: Rs ${(totals.totalPaise / 100).toFixed(2)}) Tj`)
  if (data.payment) lines.push(`0 -26 Td (Payment: ${pdfEscape(data.payment.provider)} ${pdfEscape(data.payment.status)} ${pdfEscape(data.payment.reference ?? "")}) Tj`)
  lines.push("ET")
  const stream = lines.join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  const chunks = ["%PDF-1.4\n"]
  const offsets = [0]
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(chunks.join("")))
    chunks.push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`)
  }
  const xref = Buffer.byteLength(chunks.join(""))
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return Buffer.from(chunks.join(""), "utf8")
}
