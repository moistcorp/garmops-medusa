import { aggregateArtworkReviewStatus, requiredArtworkFileIds } from "../artwork"

describe("order artwork review", () => {
  it("resolves only exact files from frozen configurations", () => {
    expect(requiredArtworkFileIds([
      { snapshot: { configuration: { artwork: { front: { fileId: "front-v2" } }, neckLabel: { fileId: "neck-v2" } } } },
      { snapshot: { configuration: { artwork: { front: { fileId: "product-2-front-v5" } } } } },
    ])).toEqual(["front-v2", "neck-v2", "product-2-front-v5"])
  })

  it("does not aggregate approval until every required file is approved", () => {
    expect(aggregateArtworkReviewStatus(["approved", "pending", "approved"])).toBe("pending")
    expect(aggregateArtworkReviewStatus(["approved", "rejected", "approved"])).toBe("rejected")
    expect(aggregateArtworkReviewStatus(["approved", "approved"])).toBe("approved")
  })
})
