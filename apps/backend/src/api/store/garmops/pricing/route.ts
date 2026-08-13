import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { priceConfiguredLine, validateConfiguredLine } from "../../../../domain/pricing"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as Record<string, unknown>
  try {
    const input = body as unknown as Parameters<typeof priceConfiguredLine>[0]
    if (body.sizes && Array.isArray(body.allowedSizes)) validateConfiguredLine({ ...input, sizes: body.sizes as Record<string, number>, allowedSizes: body.allowedSizes as string[] })
    res.json({ pricing: priceConfiguredLine(input) })
  } catch (error) {
    res.status(400).json({ code: "INVALID_CONFIGURATION", message: error instanceof Error ? error.message : "Invalid configuration" })
  }
}
