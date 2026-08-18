import { validateUpload } from "../files"

describe("customer artwork upload contract", () => {
  it("accepts a minimal customer_artwork payload with only the allowed fields", () => {
    const result = validateUpload({ kind: "customer_artwork", visibility: "customer", filename: "front artwork final.png", contentType: "image/png", byteSize: 4_000_000, sha256: "a".repeat(64), designProjectId: "dp_1" })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.extension).toBe("png")
      expect(result.value.safeFilename).toBe("front artwork final.png")
    }
  })

  it("strictly rejects backend-derived fields (safeFilename, extension) sent by the frontend BFF", () => {
    const result = validateUpload({ kind: "customer_artwork", visibility: "customer", filename: "front artwork final.png", safeFilename: "front artwork final.png", contentType: "image/png", byteSize: 4_000_000, extension: "png", sha256: "a".repeat(64), designProjectId: "dp_1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("Invalid upload request")
  })

  it("rejects unknown extra fields in general", () => {
    const result = validateUpload({ kind: "customer_artwork", visibility: "customer", filename: "front.png", contentType: "image/png", byteSize: 4_000_000, designProjectId: "dp_1", extra: true })
    expect(result.ok).toBe(false)
  })

  it("rejects an unallowed mime type for a png filename", () => {
    const result = validateUpload({ kind: "customer_artwork", visibility: "customer", filename: "front.png", contentType: "application/pdf", byteSize: 4_000_000, designProjectId: "dp_1" })
    expect(result.ok).toBe(false)
  })

  it("rejects a file that exceeds the customer_artwork size limit", () => {
    const result = validateUpload({ kind: "customer_artwork", visibility: "customer", filename: "front.png", contentType: "image/png", byteSize: 21 * 1024 * 1024, designProjectId: "dp_1" })
    expect(result.ok).toBe(false)
  })

  it("rejects a filename without an extension", () => {
    const result = validateUpload({ kind: "customer_artwork", visibility: "customer", filename: "front", contentType: "image/png", byteSize: 4_000_000, designProjectId: "dp_1" })
    expect(result.ok).toBe(false)
  })

  it("rejects a payload targeting both an order and a design project", () => {
    const result = validateUpload({ kind: "customer_artwork", visibility: "customer", filename: "front.png", contentType: "image/png", byteSize: 4_000_000, orderId: "order_1", designProjectId: "dp_1" })
    expect(result.ok).toBe(false)
  })

  it("accepts an SVG sample asset uploaded as an explicit file", () => {
    const result = validateUpload({ kind: "customer_artwork", visibility: "customer", filename: "artwork-sample.svg", contentType: "image/svg+xml", byteSize: 1_000, sha256: "b".repeat(64), designProjectId: "dp_1" })
    expect(result.ok).toBe(true)
  })
})