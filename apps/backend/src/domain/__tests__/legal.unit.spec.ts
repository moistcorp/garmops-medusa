import { canonicalJson } from "../legal"

describe("canonicalJson", () => {
  it("produces valid JSON when values are undefined", () => {
    const value = canonicalJson({
      z: undefined,
      nested: { omitted: undefined, retained: null },
      list: [undefined, "retained"],
    })

    expect(value).toBe('{"list":[null,"retained"],"nested":{"retained":null}}')
    expect(() => JSON.parse(value)).not.toThrow()
  })
})
