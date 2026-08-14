import { removeServerFingerprint } from "../middlewares"
import { shouldExposeTestOtp } from "../../auth/test-otp"

describe("HTTP security middleware", () => {
  it("removes the Express server fingerprint before continuing", async () => {
    const removeHeader = jest.fn()
    const next = jest.fn()

    await removeServerFingerprint({} as never, { removeHeader } as never, next)

    expect(removeHeader).toHaveBeenCalledWith("X-Powered-By")
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
