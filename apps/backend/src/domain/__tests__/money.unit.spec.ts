import { medusaAmountToPaise, paiseToMedusaAmount } from "../money"

describe("money boundaries", () => {
  it.each([[100, 1], [9950, 99.5], [53500, 535], [125000, 1250]])("converts %s paise to native %s INR and back", (paise, native) => {
    expect(paiseToMedusaAmount(paise)).toBe(native)
    expect(medusaAmountToPaise(native)).toBe(paise)
  })
})
