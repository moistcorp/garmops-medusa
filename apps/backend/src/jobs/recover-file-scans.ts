import type { MedusaContainer } from "@medusajs/framework/types"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { scanStoredFile } from "../services/file-scan"

export default async function recoverFileScans(container: MedusaContainer) {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const files = await service.listStoredFiles({ scan_status: "pending", state: "uploaded" }, { take: 100 })
  for (const file of files) await scanStoredFile(container, file.id)
}

export const config = { name: "garmops-malware-scan-recovery", schedule: { interval: 60_000 } }
