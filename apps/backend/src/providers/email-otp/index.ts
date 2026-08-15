import type { AuthenticationInput, AuthenticationResponse, AuthIdentityProviderService } from "@medusajs/framework/types"
import { container as medusaContainer } from "@medusajs/framework"
import { AbstractAuthModuleProvider, MedusaError, ModuleProvider, Modules } from "@medusajs/framework/utils"
import { GARMOPS_MODULE } from "../../modules/garmops"
import type GarmopsModuleService from "../../modules/garmops/service"

export class EmailOtpAuthProvider extends AbstractAuthModuleProvider {
  static identifier = "emailotp"
  static DISPLAY_NAME = "Email OTP"
  private readonly dependencies_: Record<string, unknown>

  constructor(dependencies: Record<string, unknown>, options: Record<string, unknown> = {}) {
    // The provider base class receives its dependencies through the variadic runtime constructor.
    // Its declaration omits that constructor signature.
    // @ts-expect-error Medusa provider constructor accepts injected dependencies at runtime.
    super(dependencies, options)
    this.dependencies_ = dependencies
  }

  async authenticate(data: AuthenticationInput, identityService: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    return this.verify(data, identityService)
  }

  async register(data: AuthenticationInput, identityService: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    return this.verify(data, identityService)
  }

  async update(): Promise<AuthenticationResponse> { return { success: true } }
  async validateCallback(): Promise<AuthenticationResponse> { return { success: false, error: "Email OTP does not use a callback" } }

  private async verify(data: AuthenticationInput, identityService: AuthIdentityProviderService): Promise<AuthenticationResponse> {
    const email = String(data.body?.email ?? "").trim().toLowerCase()
    const challengeId = String(data.body?.challengeId ?? "")
    const code = String(data.body?.code ?? "")
    if (!email || !challengeId || !/^\d{6}$/.test(code)) return { success: false, error: "Invalid email OTP request" }
    const service = this.dependencies_[GARMOPS_MODULE] as GarmopsModuleService
    try {
      const challenge = await service.consumeOtp(challengeId, code)
      if (challenge.email !== email) return { success: false, error: "Invalid email OTP request" }
      const customers = this.dependencies_[Modules.CUSTOMER] as { listCustomers(filters: { email: string }): Promise<Array<{ id: string }>>; createCustomers(data: Record<string, unknown>): Promise<{ id: string }> }
      const customer = (await customers.listCustomers({ email }))[0] ?? await customers.createCustomers({ email, metadata: { authSource: "email_otp" } })
      let identity
      try { identity = await identityService.retrieve({ entity_id: email }) } catch (error) {
        if (!(error instanceof MedusaError) && !(error as { type?: string })?.type) throw error
        identity = await identityService.create({ entity_id: email, user_metadata: { email } })
      }
      const auth = medusaContainer.resolve<{ updateAuthIdentities(data: { id: string; app_metadata: Record<string, string> }): Promise<unknown> }>(Modules.AUTH)
      await auth.updateAuthIdentities({ id: identity.id, app_metadata: { ...(identity.app_metadata ?? {}), customer_id: customer.id } })
      const refreshed = await identityService.retrieve({ entity_id: email })
      return { success: true, authIdentity: refreshed }
    } catch {
      return { success: false, error: "Invalid email OTP request" }
    }
  }
}

export default ModuleProvider(Modules.AUTH, { services: [EmailOtpAuthProvider] })
