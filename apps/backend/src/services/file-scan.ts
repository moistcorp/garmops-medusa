import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { scanPrivateObject } from "../integrations/malware"
import { verifyObject } from "../integrations/r2"
import { MedusaError } from "@medusajs/framework/utils"

export async function scanStoredFile(container: { resolve<T>(key: string): T }, fileId: string) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const file = await service.retrieveStoredFile(fileId)
  if (file.scan_status === "clean" || file.scan_status === "quarantined" || file.state === "rejected") return file
  if (Number(file.scan_attempts) >= 3) return service.updateStoredFiles({ id: file.id, scan_status: "failed", scan_error: "Maximum malware scan attempts exceeded" })
  const started = await service.updateStoredFiles({ id: file.id, scan_status: "pending", scan_attempts: Number(file.scan_attempts ?? 0) + 1, scan_started_at: new Date(), scan_error: null })
  try {
    const result = await scanPrivateObject(started.object_key)
    return service.updateStoredFiles({ id: file.id, scan_status: result, state: result === "clean" ? "finalized" : "rejected", scan_completed_at: new Date(), finalized_at: result === "clean" ? new Date() : null, scan_error: result === "infected" ? "Malware detected; file quarantined" : null })
  } catch (error) {
    return service.updateStoredFiles({ id: file.id, scan_status: Number(started.scan_attempts) >= 3 ? "failed" : "pending", scan_error: error instanceof Error ? error.message : "Malware scan unavailable" })
  }
}

export async function finalizeAndScanStoredFile(container: { resolve<T>(key: string): T }, fileId: string) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const file = await service.retrieveStoredFile(fileId)
  await verifyObject({ key: file.object_key, fileId: file.id, expectedBytes: Number(file.byte_size), sha256: file.sha256 ?? undefined })
  await service.updateStoredFiles({ id: file.id, state: "uploaded", scan_status: "pending" })
  return scanStoredFile(container, file.id)
}

export async function approveStoredFile(container: { resolve<T>(key: string): T }, fileId: string) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const file = await service.retrieveStoredFile(fileId)
  if (file.scan_status !== "clean" || file.state !== "finalized") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Only finalized malware-clean files can be approved")
  return service.updateStoredFiles({ id: file.id, metadata: { ...(file.metadata as Record<string, unknown> ?? {}), reviewStatus: "approved", reviewedAt: new Date().toISOString() } })
}
