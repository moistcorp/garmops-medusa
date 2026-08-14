import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { MedusaError } from "@medusajs/framework/utils"
import { testGetObject, testHeadObject, testPutObject } from "./test-doubles"

const useTestDouble = () => process.env.GARMOPS_TEST_DOUBLES === "true"

function client(): S3Client {
  const account = process.env.R2_ACCOUNT_ID
  if (!account || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new MedusaError(MedusaError.Types.INVALID_DATA, "R2 is not configured")
  return new S3Client({ region: "auto", endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } })
}
export function privateBucket(): string { if (useTestDouble()) return process.env.R2_PRIVATE_BUCKET || "garmops-e2e-private"; const value = process.env.R2_PRIVATE_BUCKET; if (!value) throw new MedusaError(MedusaError.Types.INVALID_DATA, "R2 private bucket is not configured"); return value }
export function publicBucket(): string { const value = process.env.R2_PUBLIC_BUCKET; if (!value) throw new MedusaError(MedusaError.Types.INVALID_DATA, "R2 public bucket is not configured"); return value }
export async function createSignedUpload(input: { key: string; contentType: string; contentLength: number; fileId: string; sha256?: string; expiresIn?: number }) { const metadata = { "file-id": input.fileId, "expected-size": String(input.contentLength), ...(input.sha256 ? { "expected-sha256": input.sha256 } : {}) }; if (useTestDouble()) return { key: input.key, url: `test://upload/${encodeURIComponent(input.key)}`, metadata }; const command = new PutObjectCommand({ Bucket: privateBucket(), Key: input.key, ContentType: input.contentType, ContentLength: input.contentLength, Metadata: metadata }); return { key: input.key, url: await getSignedUrl(client(), command, { expiresIn: input.expiresIn ?? 600 }) } }
export async function verifyObject(input: { key: string; fileId: string; expectedBytes: number; sha256?: string }) { const object = useTestDouble() ? testHeadObject(input.key) : await client().send(new HeadObjectCommand({ Bucket: privateBucket(), Key: input.key })); if (object.ContentLength !== input.expectedBytes || object.Metadata?.["file-id"] !== input.fileId || object.Metadata?.["expected-size"] !== String(input.expectedBytes)) throw new MedusaError(MedusaError.Types.FORBIDDEN, "Uploaded object failed ownership or size verification"); if (input.sha256 && object.Metadata?.["expected-sha256"] !== input.sha256) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Uploaded object failed checksum verification"); return object }
export async function createSignedDownload(key: string, expiresIn = 300) { if (useTestDouble()) return `test://download/${encodeURIComponent(key)}`; return getSignedUrl(client(), new GetObjectCommand({ Bucket: privateBucket(), Key: key }), { expiresIn }) }
export async function getPrivateObject(key: string) { return client().send(new GetObjectCommand({ Bucket: privateBucket(), Key: key })) }
export async function putPrivateObject(input: { key: string; body: Uint8Array; contentType: string; metadata?: Record<string, string> }) {
  if (useTestDouble()) { testPutObject(input); return { key: input.key, bucket: privateBucket(), bytes: input.body.byteLength } }
  await client().send(new PutObjectCommand({ Bucket: privateBucket(), Key: input.key, Body: input.body, ContentLength: input.body.byteLength, ContentType: input.contentType, Metadata: input.metadata }))
  return { key: input.key, bucket: privateBucket(), bytes: input.body.byteLength }
}
export async function deletePrivateObject(key: string) { if (useTestDouble()) return; await client().send(new DeleteObjectCommand({ Bucket: privateBucket(), Key: key })) }

export async function readPrivateObjectForScanner(key: string): Promise<AsyncIterable<Uint8Array>> {
  if (useTestDouble()) return testGetObject(key)
  const object = await getPrivateObject(key)
  if (!object.Body || !(Symbol.asyncIterator in Object(object.Body))) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "R2 object is not streamable")
  return object.Body as AsyncIterable<Uint8Array>
}
