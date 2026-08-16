import { normalizeRequestedDeliveryDate } from "../garmops-cart"
import { isTrustedSampleAssetUrl } from "../../domain/files"

describe("checkout delivery date normalization", () => {
  it("preserves a valid calendar date without timezone shifting", () => {
    expect(normalizeRequestedDeliveryDate("2026-09-15")).toBe("2026-09-15")
  })

  it("rejects malformed and impossible dates", () => {
    expect(() => normalizeRequestedDeliveryDate("2026-02-30")).toThrow()
    expect(() => normalizeRequestedDeliveryDate("15/09/2026")).toThrow()
  })
})

describe("trusted configurator sample assets", () => {
  it("accepts only the built-in sample asset URLs", () => {
    expect(isTrustedSampleAssetUrl("https://assets.garmops.com/garments/v1/artwork-sample.svg")).toBe(true)
    expect(isTrustedSampleAssetUrl("https://example.com/artwork-sample.svg")).toBe(false)
    expect(isTrustedSampleAssetUrl("/uploads/customer-artwork.svg")).toBe(false)
  })
})
