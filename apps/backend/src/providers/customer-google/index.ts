import { GoogleAuthService } from "@medusajs/auth-google/dist/services/google"
import { container as medusaContainer } from "@medusajs/framework"
import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
  GoogleAuthProviderOptions,
  Logger,
} from "@medusajs/framework/types"
import { ModuleProvider, Modules } from "@medusajs/framework/utils"

type Customer = { id: string }
type CustomerService = {
  listCustomers(filters: { email: string }): Promise<Customer[]>
  createCustomers(data: Record<string, unknown>): Promise<Customer>
}
type AuthService = {
  updateAuthIdentities(data: { id: string; app_metadata: Record<string, unknown> }): Promise<unknown>
}

export async function linkGoogleIdentityToCustomer(
  result: AuthenticationResponse,
  identityService: AuthIdentityProviderService,
  customerService: CustomerService,
  authService: AuthService,
): Promise<AuthenticationResponse> {
  if (!result.success || !result.authIdentity) return result

  const providerIdentity = result.authIdentity.provider_identities?.find((identity) => identity.provider === "google")
  const userMetadata = providerIdentity?.user_metadata ?? {}
  const email = String(userMetadata.email ?? "").trim().toLowerCase()
  if (!providerIdentity || !email) return { success: false, error: "Google account did not provide an email" }

  const customer = (await customerService.listCustomers({ email }))[0] ?? await customerService.createCustomers({
    email,
    first_name: userMetadata.given_name ? String(userMetadata.given_name) : undefined,
    last_name: userMetadata.family_name ? String(userMetadata.family_name) : undefined,
    metadata: { authSource: "google" },
  })
  await authService.updateAuthIdentities({
    id: result.authIdentity.id,
    app_metadata: { ...(result.authIdentity.app_metadata ?? {}), customer_id: customer.id },
  })
  const authIdentity = await identityService.retrieve({ entity_id: providerIdentity.entity_id })
  return { ...result, authIdentity }
}

export class CustomerGoogleAuthProvider extends GoogleAuthService {
  static identifier = "google"
  private readonly customerService: CustomerService

  constructor(dependencies: Record<string, unknown>, options: GoogleAuthProviderOptions) {
    super(dependencies as { logger: Logger }, options)
    this.customerService = dependencies[Modules.CUSTOMER] as CustomerService
  }

  async validateCallback(
    input: AuthenticationInput,
    identityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    const result = await super.validateCallback(input, identityService)
    if (!result.success) return result
    const authService = medusaContainer.resolve<AuthService>(Modules.AUTH)
    return linkGoogleIdentityToCustomer(result, identityService, this.customerService, authService)
  }
}

export default ModuleProvider(Modules.AUTH, { services: [CustomerGoogleAuthProvider] })
