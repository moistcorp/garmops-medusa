import { ORDER_TRANSITIONS, PUBLIC_STATUS_BY_INTERNAL, can } from "../production"

describe("production controls", () => {
  it("allows only the active state machine transitions", () => {
    expect(ORDER_TRANSITIONS.printing).toContain("stitching")
    expect(ORDER_TRANSITIONS.printing).not.toContain("delivered")
    expect(PUBLIC_STATUS_BY_INTERNAL.printing).toBe("in_production")
  })
  it("restricts operations permissions", () => {
    expect(can("operations", "review_artwork")).toBe(true)
    expect(can("operations", "manage_refunds")).toBe(false)
    expect(can("founder", "manage_refunds")).toBe(true)
  })
})
