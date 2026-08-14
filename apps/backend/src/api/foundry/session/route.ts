import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { currentStaff } from "../../../auth/staff"
import { GARMOPS_MODULE } from "../../../modules/garmops"
import type GarmopsModuleService from "../../../modules/garmops/service"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const staff = await currentStaff(req, req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE))
  if (!staff) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Staff authentication is required", requestId: req.requestId })
  return res.json({ staff: { id: staff.id, email: staff.email, name: staff.display_name, role: staff.role }, requestId: req.requestId })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await new Promise<void>((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()))
  res.clearCookie("connect.sid")
  return res.json({ success: true, requestId: req.requestId })
}

