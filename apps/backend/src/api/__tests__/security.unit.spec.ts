import { protectNativeAdmin, removeServerFingerprint } from "../middlewares"
import { shouldExposeTestOtp } from "../../auth/test-otp"

describe("HTTP security middleware", () => {
  it("removes the Express server fingerprint before continuing", async () => {
    const removeHeader = jest.fn()
    const next = jest.fn()

    await removeServerFingerprint({} as never, { removeHeader } as never, next)

    expect(removeHeader).toHaveBeenCalledWith("X-Powered-By")
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("denies Operations before any native Medusa admin route runs", async () => {
    const next = jest.fn()
    const json = jest.fn()
    const req = { auth_context: { actor_id: "user-operations", auth_identity_id: "auth-operations" }, scope: { resolve: (key: string) => key === "garmops" ? { listStaffMembers: async () => [{ role: "operations", active: true, auth_user_id: "user-operations" }] } : { retrieveAuthIdentity: async () => ({ provider_identities: [{ entity_id: "user-operations" }] }), listAuthMfa: async () => [{ status: "enabled" }] } } }
    const res = { status: jest.fn(() => ({ json })) }
    await protectNativeAdmin(req as never, res as never, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it("allows only an active Founder through the native admin boundary", async () => {
    const next = jest.fn()
    const req = { auth_context: { actor_id: "user-founder", auth_identity_id: "auth-founder" }, scope: { resolve: (key: string) => key === "garmops" ? { listStaffMembers: async () => [{ role: "founder", active: true, auth_user_id: "user-founder" }] } : { retrieveAuthIdentity: async () => ({ provider_identities: [{ entity_id: "user-founder" }] }), listAuthMfa: async () => [{ status: "enabled" }] } } }
    await protectNativeAdmin(req as never, {} as never, next)
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe("test authentication safety", () => {
  it("does not expose OTPs in production even when test flags are copied", () => {
    expect(shouldExposeTestOtp({ NODE_ENV: "production", GARMOPS_TEST_DOUBLES: "true", EXPOSE_TEST_OTP: "true" })).toBe(false)
  })

  it("requires both explicit test-double and OTP exposure flags", () => {
    expect(shouldExposeTestOtp({ NODE_ENV: "test", EXPOSE_TEST_OTP: "true" })).toBe(false)
    expect(shouldExposeTestOtp({ NODE_ENV: "test", GARMOPS_TEST_DOUBLES: "true" })).toBe(false)
    expect(shouldExposeTestOtp({ NODE_ENV: "test", GARMOPS_TEST_DOUBLES: "true", EXPOSE_TEST_OTP: "true" })).toBe(true)
  })
})
