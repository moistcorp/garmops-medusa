import type { AuthenticationResponse, AuthIdentityProviderService } from "@medusajs/framework/types"
import { linkGoogleIdentityToCustomer } from "../index"

describe("customer Google authentication", () => {
  it("creates and links a customer before the token is issued", async () => {
    const initial: AuthenticationResponse = {
      success: true,
      authIdentity: {
        id: "auth-google",
        provider_identities: [{
          id: "provider-google",
          provider: "google",
          entity_id: "google-subject",
          user_metadata: { email: "Customer@Example.com", given_name: "Customer" },
        }],
      },
    }
    const refreshed = { ...initial.authIdentity!, app_metadata: { customer_id: "cus_1" } }
    const identityService = {
      retrieve: jest.fn().mockResolvedValue(refreshed),
    } as unknown as AuthIdentityProviderService
    const customerService = {
      listCustomers: jest.fn().mockResolvedValue([]),
      createCustomers: jest.fn().mockResolvedValue({ id: "cus_1" }),
    }
    const authService = { updateAuthIdentities: jest.fn().mockResolvedValue(undefined) }

    await expect(linkGoogleIdentityToCustomer(initial, identityService, customerService, authService))
      .resolves.toEqual({ ...initial, authIdentity: refreshed })
    expect(customerService.createCustomers).toHaveBeenCalledWith(expect.objectContaining({
      email: "customer@example.com",
      first_name: "Customer",
      metadata: { authSource: "google" },
    }))
    expect(authService.updateAuthIdentities).toHaveBeenCalledWith({
      id: "auth-google",
      app_metadata: { customer_id: "cus_1" },
    })
  })
})
