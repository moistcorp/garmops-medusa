import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../modules/garmops"
import type GarmopsModuleService from "../../../modules/garmops/service"
import { Modules } from "@medusajs/framework/utils"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = req.body as { email?: string; displayName?: string; role?: string }
  const email = body.email?.trim().toLowerCase()
  if (!email || !body.displayName || !["founder", "operations"].includes(body.role ?? "")) return res.status(400).json({ code: "INVALID_STAFF", message: "Email, display name, and role are required", requestId: req.requestId })
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const customerService = req.scope.resolve(Modules.CUSTOMER) as { listCustomers: (query: { email: string }) => Promise<unknown[]> }
  if ((await customerService.listCustomers({ email })).length) return res.status(409).json({ code: "IDENTITY_COLLISION", message: "Resolve customer identity before provisioning staff", requestId: req.requestId })
  const existing = await service.listStaffMembers({ email })
  if (existing[0]) return res.status(409).json({ code: "STAFF_EXISTS", message: "Staff account already exists", requestId: req.requestId })
  const staff = await service.createStaffMembers({ email, auth_user_id: null, display_name: body.displayName, role: body.role as "founder" | "operations", active: true, provisioned_by: req.auth_context?.actor_id ?? null, metadata: null })
  res.status(201).json({ staff, requestId: req.requestId })
}
