import { findCatalogProduct, PRINT_TECHNIQUES } from "./catalog"
import { MedusaError } from "@medusajs/framework/utils"

export const GST_RATE_BASIS_POINTS = 500
export const CUSTOM_DYE_MOQ_UNITS = 100
export const CUSTOM_DYE_UNIT_INCREASE_PERCENT = 15.33
export const BACK_ARTWORK_UNIT_INCREASE_PERCENT = 22
export const NECK_LABEL_UNIT_PRICE_RUPEES = 25
export const RUSH_DELIVERY_FEE_RUPEES = 75
export const PRICING_VERSION = "custom-configurator-v3-2026-08-05-multi-item"

export const VOLUME_DISCOUNT_TIERS = [
  { minQty: 50, maxQty: 99, discountPercent: 0 },
  { minQty: 100, maxQty: 249, discountPercent: 7 },
  { minQty: 250, maxQty: 499, discountPercent: 12 },
  { minQty: 500, maxQty: 999, discountPercent: 17 },
  { minQty: 1000, maxQty: null, discountPercent: 22 },
] as const

export type ArtworkSideInput = {
  fileId?: string
  fileUrl?: string
  technique?: keyof typeof import("./catalog").PRINT_TECHNIQUES
}

export type PricingInput = {
  productSlug: string
  quantity: number
  colourType?: "signature" | "custom_dye"
  artwork?: { front?: ArtworkSideInput; back?: ArtworkSideInput }
  neckLabel?: { labelType?: "standard-size" | "custom"; fileId?: string; fileUrl?: string }
  deliveryType?: "rush" | "standard" | "flexible"
}

export type PricingSnapshot = {
  pricingVersion: string
  baseUnitPaise: number
  configuredUnitPaise: number
  discountedMerchandiseUnitPaise: number
  discountPercent: number
  volumeDiscountPaise: number
  rushSurchargeUnitPaise: number
  rushSurchargePaise: number
  unitPricePaise: number
  quantity: number
  subtotalPaise: number
  shippingPaise: number
  taxPaise: number
  totalPaise: number
  gstRateBasisPoints: number
  adjustments: readonly { label: string; amountPaise?: number; percent?: number }[]
}

export type GstBreakdown = {
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  taxPaise: number
  placeOfSupply: "intra_state" | "inter_state"
}

export function calculateTaxPaise(taxablePaise: number, rateBasisPoints = GST_RATE_BASIS_POINTS): number {
  if (!Number.isSafeInteger(taxablePaise) || taxablePaise < 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Taxable value must be a non-negative integer number of paise")
  return Math.round((taxablePaise * rateBasisPoints) / 10_000)
}

export function calculateGstBreakdown(input: {
  taxablePaise: number
  sellerState: string
  buyerState?: string | null
  rateBasisPoints?: number
}): GstBreakdown {
  const taxPaise = calculateTaxPaise(input.taxablePaise, input.rateBasisPoints)
  const intraState = Boolean(input.buyerState && input.sellerState.trim().toLowerCase() === input.buyerState.trim().toLowerCase())
  return {
    taxablePaise: input.taxablePaise,
    cgstPaise: intraState ? Math.floor(taxPaise / 2) : 0,
    sgstPaise: intraState ? taxPaise - Math.floor(taxPaise / 2) : 0,
    igstPaise: intraState ? 0 : taxPaise,
    taxPaise,
    placeOfSupply: intraState ? "intra_state" : "inter_state",
  }
}

export function getVolumeDiscountPercent(quantity: number): number {
  return VOLUME_DISCOUNT_TIERS.find((tier) => quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty))?.discountPercent ?? 0
}

function hasAsset(side?: ArtworkSideInput): boolean {
  return Boolean(side?.fileId || side?.fileUrl)
}

export function priceConfiguredLine(input: PricingInput): PricingSnapshot {
  const item = findCatalogProduct(input.productSlug)
  if (!item) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product is no longer available")
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0 || input.quantity > 1_000_000) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Quantity must be a positive safe integer")
  const adjustments: { label: string; amountPaise?: number; percent?: number }[] = []
  let unitRupees = item.basePriceRupees
  if (input.colourType === "custom_dye") {
    adjustments.push({ label: "Custom dye", percent: CUSTOM_DYE_UNIT_INCREASE_PERCENT })
    unitRupees *= 1 + CUSTOM_DYE_UNIT_INCREASE_PERCENT / 100
  }
  for (const side of ["front", "back"] as const) {
    const artwork = input.artwork?.[side]
    if (hasAsset(artwork) && artwork?.technique) {
      const technique = PRINT_TECHNIQUES[artwork.technique]
      if (!technique) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Artwork uses an unsupported print technique")
      adjustments.push({ label: `${side === "front" ? "Front" : "Back"} ${technique.label}`, amountPaise: technique.deltaRupees * 100 })
      unitRupees += technique.deltaRupees
    }
  }
  if (hasAsset(input.artwork?.back)) {
    adjustments.push({ label: "Back artwork", percent: BACK_ARTWORK_UNIT_INCREASE_PERCENT })
    unitRupees *= 1 + BACK_ARTWORK_UNIT_INCREASE_PERCENT / 100
  }
  if (input.neckLabel?.labelType === "custom" || Boolean(input.neckLabel?.fileId || input.neckLabel?.fileUrl)) {
    adjustments.push({ label: "Neck label", amountPaise: NECK_LABEL_UNIT_PRICE_RUPEES * 100 })
    unitRupees += NECK_LABEL_UNIT_PRICE_RUPEES
  }
  const baseUnitPaise = item.basePriceRupees * 100
  const configuredUnitPaise = Math.round(unitRupees * 100)
  const discountPercent = getVolumeDiscountPercent(input.quantity)
  const discountedMerchandiseUnitPaise = Math.round(configuredUnitPaise * (100 - discountPercent) / 100)
  const volumeDiscountPaise = (configuredUnitPaise - discountedMerchandiseUnitPaise) * input.quantity
  const rushSurchargeUnitPaise = input.deliveryType === "rush" ? RUSH_DELIVERY_FEE_RUPEES * 100 : 0
  if (rushSurchargeUnitPaise) adjustments.push({ label: "Rush delivery", amountPaise: rushSurchargeUnitPaise })
  const unitPricePaise = discountedMerchandiseUnitPaise + rushSurchargeUnitPaise
  const subtotalPaise = unitPricePaise * input.quantity
  const shippingPaise = 0
  const taxPaise = calculateTaxPaise(subtotalPaise)
  return Object.freeze({ pricingVersion: PRICING_VERSION, baseUnitPaise, configuredUnitPaise, discountedMerchandiseUnitPaise, discountPercent, volumeDiscountPaise, rushSurchargeUnitPaise, rushSurchargePaise: rushSurchargeUnitPaise * input.quantity, unitPricePaise, quantity: input.quantity, subtotalPaise, shippingPaise, taxPaise, totalPaise: subtotalPaise + taxPaise + shippingPaise, gstRateBasisPoints: GST_RATE_BASIS_POINTS, adjustments: Object.freeze(adjustments) })
}

export function validateConfiguredLine(input: PricingInput & { sizes: Record<string, number>; allowedSizes: readonly string[] }): void {
  const item = findCatalogProduct(input.productSlug)
  if (!item) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product is no longer available")
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Quantity must be a positive safe integer")
  if (input.colourType === "custom_dye" && input.quantity < Math.max(item.minimumOrderQuantity, CUSTOM_DYE_MOQ_UNITS)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Custom dye orders require at least 100 units")
  if (input.quantity < item.minimumOrderQuantity) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Order quantity must be at least ${item.minimumOrderQuantity}`)
  if (!input.sizes || typeof input.sizes !== "object" || Array.isArray(input.sizes)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Size allocation must be an object")
  const allowedSizes = input.allowedSizes.length ? input.allowedSizes : item.sizes
  for (const [size, quantity] of Object.entries(input.sizes)) {
    if (!allowedSizes.includes(size) || !item.sizes.includes(size) || !Number.isSafeInteger(quantity) || quantity < 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Size allocation contains an unavailable size")
  }
  if (Object.values(input.sizes).reduce((sum, quantity) => sum + quantity, 0) !== input.quantity) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Size quantities do not match configured quantity")
}

export function samplePrice(productSlug: string, size: string, quantity: number): PricingSnapshot {
  const item = findCatalogProduct(productSlug)
  if (!item || !item.sizes.includes(size) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Sample product, size, or quantity is invalid")
  const unitPricePaise = item.basePriceRupees * 100
  const subtotalPaise = unitPricePaise * quantity
  const taxPaise = calculateTaxPaise(subtotalPaise)
  return Object.freeze({ pricingVersion: "catalogue-samples-2026-01", baseUnitPaise: unitPricePaise, configuredUnitPaise: unitPricePaise, discountedMerchandiseUnitPaise: unitPricePaise, discountPercent: 0, volumeDiscountPaise: 0, rushSurchargeUnitPaise: 0, rushSurchargePaise: 0, unitPricePaise, quantity, subtotalPaise, shippingPaise: 0, taxPaise, totalPaise: subtotalPaise + taxPaise, gstRateBasisPoints: GST_RATE_BASIS_POINTS, adjustments: [] })
}
