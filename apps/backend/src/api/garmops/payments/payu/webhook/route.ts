import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { processPayuEvent } from "../../../../../services/payu-handler"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const result = await processPayuEvent(req, "webhook")
  res.status(result.status).json({ ...result.body, requestId: req.requestId })
}
