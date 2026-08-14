import { can } from "../production"

describe("foundry permissions", () => {
  it("allows founder-only financial and administration operations", () => {
    expect(can("founder", "manage_refunds")).toBe(true)
    expect(can("founder", "manage_staff")).toBe(true)
    expect(can("founder", "manage_discounts")).toBe(true)
  })
  it("keeps operations out of financial, pricing, and staff operations", () => {
    expect(can("operations", "view_all_orders")).toBe(true)
    expect(can("operations", "review_artwork")).toBe(true)
    expect(can("operations", "manage_refunds")).toBe(false)
    expect(can("operations", "manage_staff")).toBe(false)
    expect(can("operations", "manage_discounts")).toBe(false)
  })
})
