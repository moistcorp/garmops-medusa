export function shouldExposeTestOtp(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" &&
    env.GARMOPS_TEST_DOUBLES === "true" &&
    env.EXPOSE_TEST_OTP === "true"
}
