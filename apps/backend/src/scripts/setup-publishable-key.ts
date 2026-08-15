import { linkSalesChannelsToApiKeyWorkflow } from "@medusajs/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { access, mkdir, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

const KEY_TITLE = "Garmops Storefront — Local Development"
const SALES_CHANNEL_NAME = "Default Sales Channel"

export default async function setupPublishableKey({ container }: ExecArgs) {
  const outputFile = process.env.MEDUSA_PUBLISHABLE_API_KEY_FILE?.trim()
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const channels = await salesChannelService.listSalesChannels({ name: SALES_CHANNEL_NAME })
  if (channels.length !== 1) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Expected exactly one ${SALES_CHANNEL_NAME}; found ${channels.length}`)
  const salesChannel = channels[0]

  const apiKeyService = container.resolve(Modules.API_KEY)
  const existingKeys = await apiKeyService.listApiKeys({ title: KEY_TITLE, type: "publishable" }, { take: undefined })
  if (existingKeys.length > 1) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Expected at most one publishable key titled ${KEY_TITLE}; found ${existingKeys.length}`)

  const key = existingKeys[0] ?? await apiKeyService.createApiKeys({ title: KEY_TITLE, type: "publishable", created_by: "garmops-local-bootstrap" })
  const created = !existingKeys[0]

  if (outputFile) {
    if (created) {
      await mkdir(dirname(outputFile), { recursive: true })
      const temporaryFile = `${outputFile}.tmp`
      await writeFile(temporaryFile, `${key.token}\n`, { mode: 0o644 })
      await rename(temporaryFile, outputFile)
    } else {
      try {
        await access(outputFile)
      } catch {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `The existing publishable key cannot be recovered, and ${outputFile} is missing. Reuse its recorded token or create a new publishable key.`,
        )
      }
    }
  }

  const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const linkedResult = await remoteQuery({ entryPoint: "api_key", variables: { filters: { id: key.id } }, fields: ["id", "sales_channels.id"] })
  const linked = linkedResult[0]?.sales_channels ?? []
  const linkedIds = linked.map((channel: { id: string }) => channel.id)
  const add = linkedIds.includes(salesChannel.id) ? [] : [salesChannel.id]
  const remove = linkedIds.filter((id: string) => id !== salesChannel.id)
  if (add.length || remove.length) await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: key.id, add, remove } })

  console.log(`Publishable key ${created ? "created" : "reused"}: ${key.redacted}`)
  console.log(`Sales channel: ${salesChannel.name} (${salesChannel.id})`)
  console.log(`Sales-channel association: ${add.length || remove.length ? "updated" : "already correct"}`)
  if (created && outputFile) console.log(`Publishable key written to ${outputFile}`)
  else if (created) console.log(`PUBLISHABLE_API_KEY=${key.token}`)
  else console.log("Existing key token is not recoverable through Medusa after creation; reuse the previously recorded local token.")
}
