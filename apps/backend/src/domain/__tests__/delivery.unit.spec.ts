import { deliveryDateOptions, validateDeliveryDate } from "../delivery"

describe("backend delivery lead-time authority", () => {
  const now = new Date("2026-08-16T10:00:00+05:30")

  it("uses India calendar dates and working-day lead times", () => {
    const options = deliveryDateOptions(now)
    expect(options.earliestRushDate).toBe("2026-09-05")
    expect(options.earliestStandardDate).toBe("2026-09-25")
  })

  it("accepts valid rush/flexible selections and rejects an early standard date", () => {
    const options = deliveryDateOptions(now)
    expect(validateDeliveryDate({ deliveryType: "rush", requestedDeliveryDate: options.earliestRushDate, now })).toBe(options.earliestRushDate)
    expect(validateDeliveryDate({ deliveryType: "flexible", requestedDeliveryDate: options.earliestStandardDate, now })).toBe(options.earliestStandardDate)
    expect(() => validateDeliveryDate({ deliveryType: "standard", requestedDeliveryDate: "2026-08-20", now })).toThrow()
  })
})
