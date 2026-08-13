import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CATALOG, PRINT_TECHNIQUES, REFLECTIVE_COLOURS, SIGNATURE_COLOURS } from "../../../../domain/catalog"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.json({ products: CATALOG, printingTechniques: PRINT_TECHNIQUES, signatureColours: SIGNATURE_COLOURS, reflectiveColours: REFLECTIVE_COLOURS, currencyCode: "inr", shippingPaise: 0 })
}
