import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { processPayuEvent } from "../../../../../services/payu-handler"

/** PayU's top-level browser POST target. It is intentionally not the webhook JSON endpoint. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fields = req.body as Record<string, unknown>
  const frontend = process.env.FRONTEND_URL?.trim()
  if (!frontend) return res.status(503).send("Payment return is not configured")
  const destination = new URL("/payment/status", frontend)
  if (typeof fields.udf1 === "string" && fields.udf1) destination.searchParams.set("cartId", fields.udf1)
  if (typeof fields.txnid === "string" && fields.txnid) destination.searchParams.set("txnid", fields.txnid)
  try {
    await processPayuEvent(req, "callback")
  } catch {
    // The status page performs the authoritative authenticated recheck. The browser
    // return must remain usable even when webhook/order artifact work is pending.
  }
  return res.redirect(destination.toString(), 303)
}
