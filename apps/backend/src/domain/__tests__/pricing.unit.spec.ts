import { CATALOG } from "../catalog"
import { calculateGstBreakdown, CUSTOM_DYE_MOQ_UNITS, priceConfiguredLine, samplePrice, validateConfiguredLine } from "../pricing"

describe("Garmops authoritative pricing", () => {
  it("contains the active catalog and uses integer paise", () => {
    expect(CATALOG).toHaveLength(10)
    const result = priceConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 50, colourType: "signature", deliveryType: "standard" })
    expect(result.baseUnitPaise).toBe(53500)
    expect(Number.isSafeInteger(result.totalPaise)).toBe(true)
    expect(result.shippingPaise).toBe(0)
  })
  it("applies volume discounts independently per configured line", () => {
    expect(priceConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 50 }).discountPercent).toBe(0)
    expect(priceConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 100 }).discountPercent).toBe(7)
  })
  it("keeps sequential custom dye/back artwork/technique pricing", () => {
    const result = priceConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 100, colourType: "custom_dye", artwork: { front: { fileId: "f", technique: "screen_print" }, back: { fileId: "b", technique: "dtf" } }, neckLabel: { labelType: "custom" }, deliveryType: "rush" })
    expect(result.adjustments.map((row) => row.label)).toEqual(["Custom dye", "Front Screen Print", "Back DTF", "Back artwork", "Neck label", "Rush delivery"])
    expect(result.discountPercent).toBe(7)
  })
  it("enforces MOQ per line and custom-dye MOQ", () => {
    expect(() => validateConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 10, sizes: { S: 10 }, allowedSizes: ["S"] })).toThrow()
    expect(() => validateConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 50, colourType: "custom_dye", sizes: { S: 50 }, allowedSizes: ["S"] })).toThrow()
    expect(CUSTOM_DYE_MOQ_UNITS).toBe(100)
  })
  it("prices samples separately with free shipping", () => {
    const result = samplePrice("canvas-tote-bag", "One Size", 2)
    expect(result.shippingPaise).toBe(0)
    expect(result.totalPaise).toBeGreaterThan(result.subtotalPaise)
  })
  it("keeps MOQ independent for two otherwise identical configured lines", () => {
    expect(() => validateConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 10, sizes: { S: 10 }, allowedSizes: ["S"] })).toThrow()
    expect(() => validateConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 50, sizes: { S: 50 }, allowedSizes: ["S"] })).not.toThrow()
  })
  it("rejects unsupported, negative, mismatched, and zero size allocations", () => {
    expect(() => validateConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 50, sizes: { XXL: 50 }, allowedSizes: ["XXL"] })).toThrow()
    expect(() => validateConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 50, sizes: { S: -1, M: 51 }, allowedSizes: ["S", "M"] })).toThrow()
    expect(() => validateConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 50, sizes: { S: 49 }, allowedSizes: ["S"] })).toThrow()
    expect(() => validateConfiguredLine({ productSlug: "regular-fit-tee-200gsm", quantity: 0, sizes: {}, allowedSizes: [] })).toThrow()
  })
  it("splits GST intra-state and inter-state with integer-safe totals", () => {
    expect(calculateGstBreakdown({ taxablePaise: 101, sellerState: "Karnataka", buyerState: "Karnataka" })).toMatchObject({ cgstPaise: 2, sgstPaise: 3, igstPaise: 0, taxPaise: 5 })
    expect(calculateGstBreakdown({ taxablePaise: 101, sellerState: "Karnataka", buyerState: "Maharashtra" })).toMatchObject({ cgstPaise: 0, sgstPaise: 0, igstPaise: 5, taxPaise: 5 })
  })
})
