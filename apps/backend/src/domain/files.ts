import { z } from "zod"

const MiB = 1024 * 1024
export const UPLOAD_POLICIES = {
  customer_artwork: { maximumBytes: 20 * MiB, formats: { ai: ["application/postscript", "application/illustrator", "application/vnd.adobe.illustrator", "application/pdf", "application/octet-stream"], pdf: ["application/pdf"], svg: ["image/svg+xml"], png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"] } },
  approval_pdf: { maximumBytes: 20 * MiB, formats: { pdf: ["application/pdf"] } },
  proof: { maximumBytes: 20 * MiB, formats: { pdf: ["application/pdf"], png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"] } },
  qc_photo: { maximumBytes: 12 * MiB, formats: { png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"], webp: ["image/webp"] } },
  packing_list: { maximumBytes: 15 * MiB, formats: { pdf: ["application/pdf"], png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"] } },
  shipping_label: { maximumBytes: 15 * MiB, formats: { pdf: ["application/pdf"], png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"] } },
  shipment_document: { maximumBytes: 15 * MiB, formats: { pdf: ["application/pdf"], png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"] } },
} as const
export type UploadKind = keyof typeof UPLOAD_POLICIES
const uploadSchema = z.object({ orderId: z.string().optional(), designProjectId: z.string().optional(), kind: z.enum(Object.keys(UPLOAD_POLICIES) as [UploadKind, ...UploadKind[]]), visibility: z.enum(["customer", "staff_only"]), filename: z.string().trim().min(1).max(255), contentType: z.string().trim().toLowerCase(), byteSize: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/).optional() }).strict().refine((value) => Boolean(value.orderId) !== Boolean(value.designProjectId), "Exactly one upload target is required")
export function validateUpload(input: unknown): { ok: true; value: { extension: string; safeFilename: string } & z.infer<typeof uploadSchema> } | { ok: false; error: string } {
  const parsed = uploadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid upload request" }
  const filename = parsed.data.filename.normalize("NFKC")
  if (/[\\/\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(filename)) return { ok: false, error: "Invalid filename" }
  const dot = filename.lastIndexOf(".")
  if (dot <= 0 || dot === filename.length - 1) return { ok: false, error: "Filename extension is required" }
  const extension = filename.slice(dot + 1).toLowerCase()
  const policy = UPLOAD_POLICIES[parsed.data.kind]
  const allowedTypes = (policy.formats as Readonly<Record<string, readonly string[]>>)[extension]
  if (!allowedTypes?.includes(parsed.data.contentType) || parsed.data.byteSize > policy.maximumBytes) return { ok: false, error: "File type or size is not allowed" }
  const stem = filename.slice(0, dot).replace(/[^\p{L}\p{N} ._()-]+/gu, "_").replace(/\s+/g, " ").replace(/^\.+/, "").trim().slice(0, 240)
  return { ok: true, value: { ...parsed.data, extension, safeFilename: `${stem || "upload"}.${extension}` } }
}
