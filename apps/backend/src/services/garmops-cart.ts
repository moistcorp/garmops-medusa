import type { ICartModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { randomUUID } from "node:crypto"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { findCatalogProduct, PRINT_TECHNIQUES, REFLECTIVE_COLOURS } from "../domain/catalog"
import { priceConfiguredLine, samplePrice, validateConfiguredLine, type PricingSnapshot } from "../domain/pricing"

type Scope = Pick<MedusaContainer, "resolve">
type CartService = ICartModuleService
type JsonRecord = Record<string, unknown>

export type CartSummary = {
  cartId: string
  cartType: "configured" | "sample"
  lines: Array<Record<string, unknown>>
  subtotalPaise: number
  discountPaise: number
  gstPaise: number
  rushFeePaise: number
  shippingPaise: number
  grandTotalPaise: number
  validationProblems: string[]
}

function service(scope: Scope): GarmopsModuleService {
  return scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
}

function cartService(scope: Scope): CartService {
  return scope.resolve<CartService>(Modules.CART)
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}
}

function number(value: unknown, field: string): number {
  const result = Number(value)
  if (!Number.isSafeInteger(result)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${field} must be an integer amount`)
  return result
}

export function validateIndiaAddress(input: unknown, label: string): JsonRecord {
  const address = asRecord(input)
  const required = ["first_name", "address_1", "city", "province", "postal_code"]
  if (required.some((key) => typeof address[key] !== "string" || !String(address[key]).trim())) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${label} is incomplete`)
  if (!/^\d{6}$/.test(String(address.postal_code))) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${label} PIN must be six digits`)
  const country = String(address.country_code ?? "in").toLowerCase()
  if (country !== "in") throw new MedusaError(MedusaError.Types.INVALID_DATA, `${label} must be in India`)
  return { ...address, country_code: "in", province: String(address.province).trim(), city: String(address.city).trim(), postal_code: String(address.postal_code) }
}

export async function ownedCart(scope: Scope, cartId: string, customerId: string, expectedType?: "configured" | "sample") {
  if (!cartId || !customerId) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Customer authentication is required")
  const cart = await cartService(scope).retrieveCart(cartId, { relations: ["items", "billing_address", "shipping_address", "items.tax_lines"] })
  if (cart.customer_id !== customerId) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  const profile = (await service(scope).listCartProfiles({ cart_id: cartId }))[0]
  if (!profile || profile.customer_id !== customerId || (expectedType && profile.cart_type !== expectedType)) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  return { cart, profile }
}

function assertCartMutable(cart: { completed_at?: Date | string | null }): void {
  if (cart.completed_at) throw new MedusaError(MedusaError.Types.CONFLICT, "Completed carts are immutable")
  const attempt = asRecord((cart as { metadata?: unknown }).metadata).garmops_payment_attempt
  if (asRecord(attempt).status === "active") {
    const expiresAt = Date.parse(String(asRecord(attempt).expiresAt ?? ""))
    if (!Number.isFinite(expiresAt) || expiresAt > Date.now()) throw new MedusaError(MedusaError.Types.CONFLICT, "Cart is locked while a payment attempt is active")
  }
}

export async function createCustomerCart(scope: Scope, customerId: string, cartType: "configured" | "sample", email?: string) {
  const cart = await cartService(scope).createCarts({ currency_code: "inr", customer_id: customerId, email: email?.trim().toLowerCase(), metadata: { garmops_cart_type: cartType, garmops_cart_token: randomUUID() } })
  const profile = await service(scope).createCartProfiles({ cart_id: cart.id, cart_type: cartType, customer_id: customerId })
  return { cart, profile }
}

function configurationValue(configuration: JsonRecord, key: string): unknown {
  if (key in configuration) return configuration[key]
  const colour = asRecord(configuration.colour)
  if (key === "colourType") return colour.type
  return undefined
}

function validateConfigurationShape(configuration: JsonRecord): void {
  const colourType = configurationValue(configuration, "colourType")
  if (colourType !== undefined && colourType !== "signature" && colourType !== "custom_dye") throw new MedusaError(MedusaError.Types.INVALID_DATA, "Colour type is invalid")
  const artwork = asRecord(configuration.artwork)
  for (const side of ["front", "back"]) {
    const value = artwork[side]
    if (!value) continue
    const sideData = asRecord(value)
    if (sideData.fileUrl && !sideData.fileId) throw new MedusaError(MedusaError.Types.FORBIDDEN, "Artwork must reference a server-owned file")
    if (sideData.technique && !Object.prototype.hasOwnProperty.call(PRINT_TECHNIQUES, sideData.technique)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Artwork uses an unsupported print technique")
    if (sideData.technique === "reflective_print" && !REFLECTIVE_COLOURS.some((colour) => colour.key === sideData.reflectiveColour)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Reflective artwork requires an allowed reflective colour")
  }
  const label = asRecord(configuration.neckLabel)
  if (label.fileUrl && !label.fileId) throw new MedusaError(MedusaError.Types.FORBIDDEN, "Neck label must reference a server-owned file")
  const delivery = configuration.deliveryType
  if (delivery !== undefined && delivery !== "rush" && delivery !== "standard" && delivery !== "flexible") throw new MedusaError(MedusaError.Types.INVALID_DATA, "Delivery preference is invalid")
}

async function verifyFileOwnership(scope: Scope, configuration: JsonRecord, customerId: string) {
  const artwork = asRecord(configuration.artwork)
  const values = [artwork.front, artwork.back, configuration.neckLabel]
  for (const value of values) {
    const fileId = asRecord(value).fileId
    if (typeof fileId !== "string") continue
    const file = await service(scope).retrieveStoredFile(fileId)
    if (file.customer_id !== customerId || file.state !== "finalized" || file.scan_status !== "clean") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "All referenced artwork must be finalized and malware-clean")
  }
}

export async function validateConfiguredInput(scope: Scope, input: { customerId: string; projectId: string; versionId?: string; quantity?: number; sizes?: Record<string, number>; sizeBreakdown?: Record<string, number>; deliveryType?: string; configuration?: JsonRecord }) {
  const garmops = service(scope)
  const project = await garmops.retrieveDesignProject(input.projectId)
  if (project.owner_customer_id !== input.customerId || project.archived) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Design project not found")
  const versionId = input.versionId ?? project.active_version_id
  if (!versionId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "A design version is required")
  const version = await garmops.retrieveDesignVersion(versionId)
  if (version.project_id !== project.id) throw new MedusaError(MedusaError.Types.FORBIDDEN, "Design version does not belong to the project")
  const product = findCatalogProduct(version.product_slug)
  if (!product) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product is no longer available")
  const configuration = { ...asRecord(version.configuration), ...asRecord(input.configuration) }
  const quantity = input.quantity ?? version.quantity
  const sizes = input.sizes ?? input.sizeBreakdown
  if (!sizes) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Size breakdown is required")
  validateConfigurationShape(configuration)
  await verifyFileOwnership(scope, configuration, input.customerId)
  const colourType = configurationValue(configuration, "colourType") as "signature" | "custom_dye" | undefined
  const artwork = asRecord(configuration.artwork) as never
  const neckLabel = asRecord(configuration.neckLabel) as never
  const deliveryType = (input.deliveryType ?? configuration.deliveryType ?? "standard") as "rush" | "standard" | "flexible"
  validateConfiguredLine({ productSlug: product.slug, quantity, sizes, allowedSizes: product.sizes, colourType, artwork, neckLabel, deliveryType })
  const pricing = priceConfiguredLine({ productSlug: product.slug, quantity, colourType, artwork, neckLabel, deliveryType })
  return { project, version, product, configuration, quantity, sizes, deliveryType, pricing }
}

function nativeLineData(input: { product: { slug: string; name: string; technicalName: string }; quantity: number; pricing: PricingSnapshot; configuration: JsonRecord; projectId: string; versionId: string; sizes: Record<string, number>; deliveryType: string }) {
  return {
    title: input.product.name,
    product_title: input.product.technicalName,
    quantity: input.quantity,
    requires_shipping: false,
    unit_price: input.pricing.unitPricePaise,
    is_custom_price: true,
    is_tax_inclusive: false,
    tax_lines: [{ code: "GST", rate: 5, description: "Goods and Services Tax" }],
    metadata: { garmops_configured: true, garmops_project_id: input.projectId, garmops_version_id: input.versionId, garmops_product_slug: input.product.slug, garmops_size_breakdown: input.sizes, garmops_delivery_type: input.deliveryType, garmops_configuration: input.configuration, garmops_pricing_snapshot: input.pricing },
  }
}

export async function addConfiguredLine(scope: Scope, input: { cartId: string; customerId: string; projectId: string; versionId?: string; quantity?: number; sizes?: Record<string, number>; sizeBreakdown?: Record<string, number>; deliveryType?: string; configuration?: JsonRecord }) {
  const { cart, profile } = await ownedCart(scope, input.cartId, input.customerId, "configured")
  assertCartMutable(cart)
  const validated = await validateConfiguredInput(scope, input)
  const item = (await cartService(scope).addLineItems({ cart_id: cart.id, ...nativeLineData({ ...validated, projectId: validated.project.id, versionId: validated.version.id }) }))[0]
  const line = await service(scope).createConfiguredCartLines({ cart_id: cart.id, line_item_id: item.id, customer_id: input.customerId, project_id: validated.project.id, version_id: validated.version.id, product_slug: validated.product.slug, quantity: validated.quantity, size_breakdown: validated.sizes, delivery_type: validated.deliveryType, validated: true, pricing_snapshot: validated.pricing })
  return { cart, profile, line, pricing: validated.pricing }
}

export async function updateConfiguredLine(scope: Scope, input: { lineId: string; customerId: string; versionId?: string; quantity?: number; sizes?: Record<string, number>; sizeBreakdown?: Record<string, number>; deliveryType?: string; configuration?: JsonRecord }) {
  const line = await service(scope).retrieveConfiguredCartLine(input.lineId)
  const { cart } = await ownedCart(scope, line.cart_id, input.customerId, "configured")
  assertCartMutable(cart)
  const validated = await validateConfiguredInput(scope, { customerId: input.customerId, projectId: line.project_id, versionId: input.versionId ?? line.version_id, quantity: input.quantity, sizes: input.sizes, sizeBreakdown: input.sizeBreakdown, deliveryType: input.deliveryType, configuration: input.configuration })
  if (!line.line_item_id) throw new MedusaError(MedusaError.Types.CONFLICT, "Configured line is missing its native cart line")
  await cartService(scope).updateLineItems(line.line_item_id, nativeLineData({ ...validated, projectId: validated.project.id, versionId: validated.version.id }))
  const updated = await service(scope).updateConfiguredCartLines({ id: line.id, version_id: validated.version.id, product_slug: validated.product.slug, quantity: validated.quantity, size_breakdown: validated.sizes, delivery_type: validated.deliveryType, validated: true, pricing_snapshot: validated.pricing })
  return { cart, line: updated, pricing: validated.pricing }
}

export async function removeConfiguredLine(scope: Scope, lineId: string, customerId: string) {
  const line = await service(scope).retrieveConfiguredCartLine(lineId)
  const { cart } = await ownedCart(scope, line.cart_id, customerId, "configured")
  assertCartMutable(cart)
  if (line.line_item_id) await cartService(scope).deleteLineItems(line.line_item_id)
  await service(scope).deleteConfiguredCartLines(line.id)
}

export async function addSampleLine(scope: Scope, input: { cartId: string; customerId: string; productSlug: string; size: string; quantity: number }) {
  const { cart, profile } = await ownedCart(scope, input.cartId, input.customerId, "sample")
  assertCartMutable(cart)
  const pricing = samplePrice(input.productSlug, input.size, input.quantity)
  const product = findCatalogProduct(input.productSlug)
  if (!product) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product is no longer available")
  const existing = (cart.items ?? []).find((item) => item.metadata?.garmops_sample_product_slug === input.productSlug && item.metadata?.garmops_sample_size === input.size)
  if (!existing && (cart.items ?? []).filter((item) => item.metadata?.garmops_sample === true).length >= 50) throw new MedusaError(MedusaError.Types.INVALID_DATA, "A sample cart can contain at most 50 lines")
  const existingQuantity = existing ? number(existing.quantity, "quantity") : 0
  if (existingQuantity + input.quantity > 100) throw new MedusaError(MedusaError.Types.INVALID_DATA, "A sample size can contain at most 100 units")
  let item
  if (existing) item = await cartService(scope).updateLineItems(existing.id, { quantity: existingQuantity + input.quantity, unit_price: pricing.unitPricePaise, is_custom_price: true, is_tax_inclusive: false, metadata: { ...(existing.metadata ?? {}), garmops_sample_pricing_snapshot: pricing } })
  else item = (await cartService(scope).addLineItems({ cart_id: cart.id, title: `${product.name} sample`, product_title: product.technicalName, quantity: input.quantity, requires_shipping: false, unit_price: pricing.unitPricePaise, is_custom_price: true, is_tax_inclusive: false, tax_lines: [{ code: "GST", rate: 5, description: "Goods and Services Tax" }], metadata: { garmops_sample: true, garmops_sample_product_slug: input.productSlug, garmops_sample_size: input.size, garmops_sample_pricing_snapshot: pricing } }))[0]
  return { cart, profile, item, pricing }
}

export async function updateSampleLine(scope: Scope, input: { lineId: string; customerId: string; productSlug?: string; size?: string; quantity?: number }) {
  const item = await cartService(scope).retrieveLineItem(input.lineId)
  const { cart } = await ownedCart(scope, String(item.cart_id), input.customerId, "sample")
  assertCartMutable(cart)
  const metadata = asRecord(item.metadata)
  if (metadata.garmops_sample !== true) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sample line not found")
  const productSlug = input.productSlug ?? String(metadata.garmops_sample_product_slug ?? "")
  const size = input.size ?? String(metadata.garmops_sample_size ?? "")
  const quantity = input.quantity ?? number(item.quantity, "quantity")
  const pricing = samplePrice(productSlug, size, quantity)
  if (quantity > 100) throw new MedusaError(MedusaError.Types.INVALID_DATA, "A sample size can contain at most 100 units")
  const updated = await cartService(scope).updateLineItems(item.id, { quantity, unit_price: pricing.unitPricePaise, is_custom_price: true, is_tax_inclusive: false, metadata: { ...metadata, garmops_sample_product_slug: productSlug, garmops_sample_size: size, garmops_sample_pricing_snapshot: pricing } })
  return { cart, item: updated, pricing }
}

export async function removeSampleLine(scope: Scope, lineId: string, customerId: string) {
  const item = await cartService(scope).retrieveLineItem(lineId)
  const { cart } = await ownedCart(scope, String(item.cart_id), customerId, "sample")
  assertCartMutable(cart)
  await cartService(scope).deleteLineItems(lineId)
}

export async function summarizeCart(scope: Scope, cartId: string, customerId: string): Promise<CartSummary> {
  const { cart, profile } = await ownedCart(scope, cartId, customerId)
  const garmops = service(scope)
  const configured = await garmops.listConfiguredCartLines({ cart_id: cart.id }, { order: { created_at: "ASC" } })
  const lines: Array<Record<string, unknown>> = []
  let subtotalPaise = 0
  let discountPaise = 0
  let gstPaise = 0
  let rushFeePaise = 0
  if (profile.cart_type === "configured") {
    for (const line of configured) {
      const pricing = asRecord(line.pricing_snapshot) as PricingSnapshot
      const product = findCatalogProduct(line.product_slug)
      subtotalPaise += Number(pricing.subtotalPaise ?? 0)
      discountPaise += Number(pricing.volumeDiscountPaise ?? 0)
      gstPaise += Number(pricing.taxPaise ?? 0)
      rushFeePaise += Number(pricing.rushSurchargePaise ?? 0)
      lines.push({ id: line.id, lineItemId: line.line_item_id, product: product ? { slug: product.slug, name: product.name } : { slug: line.product_slug }, projectId: line.project_id, versionId: line.version_id, quantity: line.quantity, sizeBreakdown: line.size_breakdown, deliveryType: line.delivery_type, pricing })
    }
  } else {
    for (const item of cart.items ?? []) {
      const metadata = asRecord(item.metadata)
      const productSlug = String(metadata.garmops_sample_product_slug ?? "")
      const size = String(metadata.garmops_sample_size ?? "")
      if (!productSlug || !size) continue
      const pricing = samplePrice(productSlug, size, number(item.quantity, "quantity"))
      subtotalPaise += pricing.subtotalPaise
      gstPaise += pricing.taxPaise
      lines.push({ id: item.id, lineItemId: item.id, product: { slug: productSlug, name: findCatalogProduct(productSlug)?.name ?? productSlug }, size, quantity: item.quantity, pricing })
    }
  }
  const problems: string[] = []
  if (profile.cart_type === "configured" && !lines.length) problems.push("Configured cart must contain at least one configured line")
  return { cartId: cart.id, cartType: profile.cart_type, lines, subtotalPaise, discountPaise, gstPaise, rushFeePaise, shippingPaise: 0, grandTotalPaise: subtotalPaise + gstPaise, validationProblems: problems }
}

export async function saveCheckout(scope: Scope, input: { cartId: string; customerId: string; email: string; projectName?: string; orderNotes?: string; gstin?: string; billingEntity?: string; shippingAddress: unknown; billingAddress?: unknown; termsVersion: string; privacyVersion?: string; requestedDeliveryDate?: string; deliveryPreference?: string; requestId?: string }) {
  const { cart } = await ownedCart(scope, input.cartId, input.customerId)
  assertCartMutable(cart)
  if (!input.termsVersion.trim()) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Current terms acceptance is required")
  const shipping = validateIndiaAddress(input.shippingAddress, "Shipping address")
  const billing = validateIndiaAddress(input.billingAddress ?? input.shippingAddress, "Billing address")
  if (input.gstin && !/^[0-9A-Z]{15}$/.test(input.gstin.toUpperCase())) throw new MedusaError(MedusaError.Types.INVALID_DATA, "GSTIN is invalid")
  const requestedDeliveryDate = normalizeRequestedDeliveryDate(input.requestedDeliveryDate)
  const metadata = { ...(cart.metadata ?? {}), garmops_checkout: { projectName: input.projectName?.trim(), orderNotes: input.orderNotes?.trim(), gstin: input.gstin?.toUpperCase(), billingEntity: input.billingEntity?.trim(), deliveryPreference: input.deliveryPreference, requestedDeliveryDate, termsVersion: input.termsVersion, privacyVersion: input.privacyVersion, acceptedAt: new Date().toISOString() } }
  const updated = await cartService(scope).updateCarts(cart.id, { email: input.email.trim().toLowerCase(), shipping_address: shipping, billing_address: { ...billing, company: input.billingEntity?.trim(), metadata: { ...(billing.metadata as JsonRecord ?? {}), gstin: input.gstin?.toUpperCase() } }, metadata })
  await service(scope).createTermsAcceptances({ customer_id: input.customerId, order_id: null, terms_version: input.termsVersion, privacy_version: input.privacyVersion ?? null, accepted_at: new Date(), request_id: input.requestId ?? null })
  return updated
}

export function normalizeRequestedDeliveryDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Requested delivery date must be a calendar date")
  const [year, month, day] = value.split("-").map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Requested delivery date is invalid")
  return value
}

export async function saveCheckoutDetails(scope: Scope, input: { cartId: string; customerId: string; email: string; shippingAddress: unknown; billingAddress?: unknown; gstin?: string; billingEntity?: string; requestedDeliveryDate?: string; deliveryPreference?: string }) {
  const { cart } = await ownedCart(scope, input.cartId, input.customerId)
  assertCartMutable(cart)
  const shipping = validateIndiaAddress(input.shippingAddress, "Shipping address")
  const billing = validateIndiaAddress(input.billingAddress ?? input.shippingAddress, "Billing address")
  if (input.gstin && !/^[0-9A-Z]{15}$/.test(input.gstin.toUpperCase())) throw new MedusaError(MedusaError.Types.INVALID_DATA, "GSTIN is invalid")
  const requestedDeliveryDate = normalizeRequestedDeliveryDate(input.requestedDeliveryDate)
  const previous = asRecord(cart.metadata?.garmops_checkout)
  const metadata = {
    ...(cart.metadata ?? {}),
    garmops_checkout: {
      ...previous,
      gstin: input.gstin?.toUpperCase(),
      billingEntity: input.billingEntity?.trim(),
      deliveryPreference: input.deliveryPreference,
      requestedDeliveryDate,
    },
  }
  return cartService(scope).updateCarts(cart.id, {
    email: input.email.trim().toLowerCase(),
    shipping_address: shipping,
    billing_address: { ...billing, company: input.billingEntity?.trim(), metadata: { ...(billing.metadata as JsonRecord ?? {}), gstin: input.gstin?.toUpperCase() } },
    metadata,
  })
}
