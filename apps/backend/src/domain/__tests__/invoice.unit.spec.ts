import { calculateInvoiceTotals, renderInvoicePdf, type InvoiceData } from "../invoice"

const invoice: InvoiceData = {
  invoiceNumber: "INV-2026-000001", invoiceDate: "2026-08-13", orderNumber: "GAR-2026-000001",
  seller: { name: "Garmops", gstin: "29AAAAA0000A1Z5", address: "Bengaluru", state: "Karnataka" },
  buyer: { name: "Customer", address: "Mumbai", state: "Maharashtra" },
  lines: [{ description: "Classic T-Shirt", hsn: "6109", quantity: 50, unitPaise: 53500, discountPaise: 0, taxablePaise: 2675000 }],
  payment: { provider: "PayU", reference: "mihpayid-1", status: "paid" },
}

describe("GST invoice", () => {
  it("reconciles inter-state invoice totals", () => expect(calculateInvoiceTotals(invoice)).toMatchObject({ subtotalPaise: 2675000, igstPaise: 133750, totalPaise: 2808750 }))
  it("renders a deterministic Linux-safe PDF without browser dependencies", () => {
    const pdf = renderInvoicePdf(invoice)
    expect(pdf.subarray(0, 8).toString()).toBe("%PDF-1.4")
    expect(pdf.toString()).toContain("INV-2026-000001")
    expect(pdf.toString()).toContain("28087.50")
  })
})
