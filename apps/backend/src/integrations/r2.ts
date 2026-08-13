import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

function client(): S3Client {
  const account = process.env.R2_ACCOUNT_ID
  if (!account || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error("R2 is not configured")
  return new S3Client({ region: "auto", endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } })
}
export function privateBucket(): string { const value = process.env.R2_PRIVATE_BUCKET; if (!value) throw new Error("R2 private bucket is not configured"); return value }
export function publicBucket(): string { const value = process.env.R2_PUBLIC_BUCKET; if (!value) throw new Error("R2 public bucket is not configured"); return value }
export async function createSignedUpload(input: { key: string; contentType: string; contentLength: number; fileId: string; sha256?: string; expiresIn?: number }) { const command = new PutObjectCommand({ Bucket: privateBucket(), Key: input.key, ContentType: input.contentType, ContentLength: input.contentLength, Metadata: { "file-id": input.fileId, "expected-size": String(input.contentLength), ...(input.sha256 ? { "expected-sha256": input.sha256 } : {}) } }); return { key: input.key, url: await getSignedUrl(client(), command, { expiresIn: input.expiresIn ?? 600 }) } }
export async function verifyObject(input: { key: string; fileId: string; expectedBytes: number; sha256?: string }) { const object = await client().send(new HeadObjectCommand({ Bucket: privateBucket(), Key: input.key })); if (object.ContentLength !== input.expectedBytes || object.Metadata?.["file-id"] !== input.fileId || object.Metadata?.["expected-size"] !== String(input.expectedBytes)) throw new Error("Uploaded object failed ownership or size verification"); if (input.sha256 && object.Metadata?.["expected-sha256"] !== input.sha256) throw new Error("Uploaded object failed checksum verification"); return object }
export async function createSignedDownload(key: string, expiresIn = 300) { return getSignedUrl(client(), new GetObjectCommand({ Bucket: privateBucket(), Key: key }), { expiresIn }) }
export async function deletePrivateObject(key: string) { await client().send(new DeleteObjectCommand({ Bucket: privateBucket(), Key: key })) }
