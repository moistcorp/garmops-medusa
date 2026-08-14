import { injectTestFailure } from "../test-failures"

describe("test failure controls", () => {
  it("cannot inject a failure without explicit test doubles", () => {
    expect(() => injectTestFailure("r2-put", { GARMOPS_TEST_FAILURE: "r2-put" })).not.toThrow()
  })

  it("injects only the selected test failure point", () => {
    const env = { GARMOPS_TEST_DOUBLES: "true", GARMOPS_TEST_FAILURE: "r2-put" }
    expect(() => injectTestFailure("r2-put", env)).toThrow("Injected test failure: r2-put")
    expect(() => injectTestFailure("resend", env)).not.toThrow()
  })

  it("cannot inject failures in production even when test flags are present", () => {
    const env = { NODE_ENV: "production", GARMOPS_TEST_DOUBLES: "true", GARMOPS_TEST_FAILURE: "all" }
    expect(() => injectTestFailure("r2-put", env)).not.toThrow()
    expect(() => injectTestFailure("resend", env)).not.toThrow()
  })
})
