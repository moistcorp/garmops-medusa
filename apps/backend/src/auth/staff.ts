import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { can, type StaffRole } from "../domain/production"
import type GarmopsModuleService from "../modules/garmops/service"
import { Modules } from "@medusajs/framework/utils"

export async function currentStaff(req: AuthenticatedMedusaRequest, service: GarmopsModuleService, options?: { allowMfaPending?: boolean }) {
  const actorId = req.auth_context?.actor_id
  const authIdentityId = req.auth_context?.auth_identity_id
  const auth = authIdentityId ? req.scope.resolve<any>(Modules.AUTH) : undefined
  const identity = authIdentityId && auth ? await auth.retrieveAuthIdentity(authIdentityId, { relations: ["provider_identities"] }) : undefined
  const providerEntityIds = (identity?.provider_identities ?? []).map((provider: { entity_id?: string }) => provider.entity_id).filter((id: unknown): id is string => typeof id === "string")
  const candidateIds = [actorId, ...providerEntityIds, identity?.app_metadata?.user_id].filter((id): id is string => typeof id === "string")
  const staff = (await Promise.all(candidateIds.map((id) => service.listStaffMembers({ auth_user_id: id, active: true })))).flat()[0] as { id: string; role: StaffRole; email: string; active: boolean; display_name: string } | undefined
  if (!staff) return undefined
  if (options?.allowMfaPending) return staff
  // An actorless token is intentionally sufficient only to enroll or complete MFA;
  // it must never be accepted for a privileged Foundry request.
  if (!actorId || !authIdentityId) return undefined
  const factors = await auth?.listAuthMfa({ auth_identity_id: authIdentityId, provider: "totp", status: "enabled" })
  return factors.length ? staff : undefined
}

export async function hasStaffPermission(req: AuthenticatedMedusaRequest, service: GarmopsModuleService, permission: string) {
  const staff = await currentStaff(req, service)
  return staff?.role ? can(staff.role, permission) : false
}
