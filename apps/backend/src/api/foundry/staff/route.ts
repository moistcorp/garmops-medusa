import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GARMOPS_MODULE } from "../../../modules/garmops"
import type GarmopsModuleService from "../../../modules/garmops/service"
import { hasStaffPermission } from "../../../auth/staff"
import { currentStaff } from "../../../auth/staff"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if (!(await hasStaffPermission(req, service, "manage_staff"))) return res.status(403).json({ code: "FORBIDDEN", message: "Founder permission required", requestId: req.requestId })
  res.status(405).json({ code: "CLI_PROVISIONING_REQUIRED", message: "Staff accounts are provisioned only with npm run staff:create", requestId: req.requestId })
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const staff = await currentStaff(req, service)
  if (!staff) return res.status(403).json({ code: "FORBIDDEN", message: "Active staff role required", requestId: req.requestId })
  return res.json({ staff: { id: staff.id, email: staff.email, name: staff.display_name, role: staff.role }, requestId: req.requestId })
}
