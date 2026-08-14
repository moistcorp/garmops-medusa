import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { can, type StaffRole } from "../domain/production"
import type GarmopsModuleService from "../modules/garmops/service"

export async function currentStaff(req: AuthenticatedMedusaRequest, service: GarmopsModuleService) {
  const actorId = req.auth_context?.actor_id
  if (!actorId) return undefined
  return (await service.listStaffMembers({ auth_user_id: actorId, active: true }))[0] as { id: string; role: StaffRole; email: string; active: boolean; display_name: string } | undefined
}

export async function hasStaffPermission(req: AuthenticatedMedusaRequest, service: GarmopsModuleService, permission: string) {
  const staff = await currentStaff(req, service)
  return staff?.role ? can(staff.role, permission) : false
}
