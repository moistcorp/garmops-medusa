import { normalizeRequestedDeliveryDate } from "../garmops-cart"

describe("checkout delivery date normalization", () => {
  it("preserves a valid calendar date without timezone shifting", () => {
    expect(normalizeRequestedDeliveryDate("2026-09-15")).toBe("2026-09-15")
  })

  it("rejects malformed and impossible dates", () => {
    expect(() => normalizeRequestedDeliveryDate("2026-02-30")).toThrow()
    expect(() => normalizeRequestedDeliveryDate("15/09/2026")).toThrow()
  })
})
