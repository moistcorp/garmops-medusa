import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pin = String(req.params.pin || "")
  if (!/^[1-9][0-9]{5}$/.test(pin)) return res.status(400).json({ code: "INVALID_PIN", message: "PIN must be a six-digit Indian PIN", requestId: req.requestId })
  try {
    const response = await fetch("https://api.postalpincode.in/pincode/" + pin, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } })
    if (!response.ok) return res.status(502).json({ code: "PIN_LOOKUP_UNAVAILABLE", message: "PIN lookup is temporarily unavailable", requestId: req.requestId })
    const body = await response.json() as Array<{ Status?: string; PostOffice?: Array<{ Name?: string; District?: string; State?: string; Country?: string }> }>
    const office = body[0]?.PostOffice?.[0]
    if (!office || body[0]?.Status !== "Success" || office.Country !== "India") return res.status(404).json({ code: "PIN_NOT_FOUND", message: "PIN could not be resolved", requestId: req.requestId })
    res.json({ pin, city: office.District ?? office.Name, state: office.State, country: "India", requestId: req.requestId })
  } catch { res.status(502).json({ code: "PIN_LOOKUP_UNAVAILABLE", message: "PIN lookup is temporarily unavailable", requestId: req.requestId }) }
}
