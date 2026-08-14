import { MedusaError } from "@medusajs/framework/utils"

export type TestFailurePoint = "r2-upload" | "r2-verify" | "r2-download" | "r2-put" | "r2-read" | "resend" | "invoice"

export function injectTestFailure(point: TestFailurePoint, env: NodeJS.ProcessEnv = process.env): void {
  if (env.GARMOPS_TEST_DOUBLES !== "true") return
  const configured = env.GARMOPS_TEST_FAILURE
  if (configured === point || configured === "all") throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Injected test failure: ${point}`)
}
