import { createHash } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

type StoredTestObject = {
  body: Uint8Array
  contentType: string
  metadata: Record<string, string>
}

type TestState = {
  objects: Map<string, StoredTestObject>
  notifications: Array<Record<string, unknown>>
  paymentCommands: Array<Record<string, unknown>>
}

const state: TestState = {
  objects: new Map(),
  notifications: [],
  paymentCommands: [],
}

export function testState(): TestState {
  return state
}

export function resetTestState(): void {
  state.objects.clear()
  state.notifications.length = 0
  state.paymentCommands.length = 0
}

export function testPutObject(input: {
  key: string
  body: Uint8Array
  contentType: string
  metadata?: Record<string, string>
}): void {
  state.objects.set(input.key, {
    body: input.body,
    contentType: input.contentType,
    metadata: input.metadata ?? {},
  })
}

export function testHeadObject(key: string): {
  ContentLength: number
  ContentType: string
  Metadata: Record<string, string>
} {
  const object = state.objects.get(key)
  if (!object) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Test object does not exist")
  return {
    ContentLength: object.body.byteLength,
    ContentType: object.contentType,
    Metadata: object.metadata,
  }
}

export function testGetObject(key: string): AsyncIterable<Uint8Array> {
  const object = state.objects.get(key)
  if (!object) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Test object does not exist")
  return (async function* () {
    yield object.body
  })()
}

export function testObjectSha256(key: string): string {
  const object = state.objects.get(key)
  if (!object) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Test object does not exist")
  return createHash("sha256").update(object.body).digest("hex")
}
