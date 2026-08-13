import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
export async function GET(_req: MedusaRequest, res: MedusaResponse) { res.json({ service: "garmops", status: "ok", integrations: { database: "medusa", redis: Boolean(process.env.REDIS_URL), payu: Boolean(process.env.PAYU_KEY && process.env.PAYU_SALT), r2: Boolean(process.env.R2_ACCOUNT_ID) } }) }
