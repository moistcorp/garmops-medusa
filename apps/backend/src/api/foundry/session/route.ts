import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { currentStaff } from "../../../auth/staff"
import { GARMOPS_MODULE } from "../../../modules/garmops"
import type GarmopsModuleService from "../../../modules/garmops/service"
import { Modules } from "@medusajs/framework/utils"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const allowMfaPending = String(req.query.allowMfaPending ?? "") === "true"
  const staff = await currentStaff(req, req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE), { allowMfaPending })
  if (!staff) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Staff authentication is required", requestId: req.requestId })
  const authIdentityId = req.auth_context?.auth_identity_id
  const factors = authIdentityId ? await req.scope.resolve<any>(Modules.AUTH).listAuthMfa({ auth_identity_id: authIdentityId, provider: "totp", status: "enabled" }) : []
  return res.json({ staff: { id: staff.id, email: staff.email, name: staff.display_name, role: staff.role }, mfaRequired: factors.length === 0, requestId: req.requestId })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await new Promise<void>((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()))
  res.clearCookie("connect.sid")
  return res.json({ success: true, requestId: req.requestId })
}
