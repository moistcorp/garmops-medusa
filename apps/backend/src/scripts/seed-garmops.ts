import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { CATALOG } from "../domain/catalog"

export default async function seedGarmops({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const channels = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" })
  const salesChannelId = channels[0]?.id
  if (!salesChannelId) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Default Sales Channel is required before catalog bootstrap")
  let created = 0
  for (const item of CATALOG) {
    const existing = await productService.listProducts({ handle: item.slug })
    const payload = {
      title: item.name,
      handle: item.slug,
      description: item.description,
      status: "published",
      thumbnail: item.image ?? undefined,
      metadata: { ...item.metadata, technicalName: item.technicalName, gsm: item.gsm, material: item.material, fit: item.fit, sizes: item.sizes, minimumOrderQuantity: item.minimumOrderQuantity, details: item.details, careInstructions: item.careInstructions },
      options: [{ title: "Size", values: [...item.sizes] }],
      variants: [{ title: `${item.name} configured`, sku: `garmops-${item.slug}-configured`, manage_inventory: false, allow_backorder: true, prices: [{ currency_code: "inr", amount: item.basePriceRupees }], options: { Size: item.sizes[0] } }],
      sales_channels: [{ id: salesChannelId }],
    }
    if (existing[0]) {
      const current = await productService.retrieveProduct(existing[0].id, { relations: ["options"] })
      const sizeOption = current.options?.find((option) => option.title === "Size")
      if (sizeOption) {
        const values = [...new Set([...(sizeOption.values ?? []).map((value) => value.value), ...item.sizes])]
        await productService.updateProductOptions(sizeOption.id, { values, ranks: Object.fromEntries(values.map((value, index) => [value, index])) })
      }
      await productService.updateProducts(existing[0].id, { title: payload.title, handle: payload.handle, description: payload.description, status: payload.status, thumbnail: payload.thumbnail, metadata: payload.metadata } as never)
    } else { await productService.createProducts(payload as never); created += 1 }
  }
  console.log(`Garmops catalog bootstrap complete: ${CATALOG.length} canonical products, ${created} created.`)
}
