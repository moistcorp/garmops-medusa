import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ICartModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { MedusaError } from "@medusajs/framework/utils"
import { GARMOPS_MODULE } from "../../../../../../modules/garmops"
import type GarmopsModuleService from "../../../../../../modules/garmops/service"
import { findCatalogProduct } from "../../../../../../domain/catalog"
import { priceConfiguredLine, samplePrice, validateConfiguredLine } from "../../../../../../domain/pricing"
import { initiatePayuPaymentWorkflow } from "../../../../../../workflows/initiate-payu-payment"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const cartId = String((req.body as Record<string, unknown>).cartId ?? "")
  const actorId = req.auth_context?.actor_id
  if (!cartId || !actorId) return res.status(401).json({ code: "UNAUTHENTICATED", message: "Customer authentication is required", requestId: req.requestId })
  try {
    const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)
    const cart = await cartService.retrieveCart(cartId, { relations: ["items", "billing_address", "shipping_address"] })
    if (cart.customer_id !== actorId) return res.status(404).json({ code: "CART_NOT_FOUND", message: "Cart not found", requestId: req.requestId })
    const service = req.scope.resolve<GarmopsModuleService>(GARMOPS_MODULE)
    const profile = (await service.listCartProfiles({ cart_id: cartId }))[0]
    if (!profile || profile.customer_id !== actorId) return res.status(409).json({ code: "CART_PROFILE_INVALID", message: "Cart ownership or type is invalid", requestId: req.requestId })
    const lines = await service.listConfiguredCartLines({ cart_id: cartId })
    let authoritativeTotal = 0
    if (profile.cart_type === "configured") {
      if (!lines.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Configured cart has no configured lines")
      for (const line of lines) {
        const version = await service.retrieveDesignVersion(line.version_id)
        const configuration = version.configuration as Record<string, unknown>
        const sizes = line.size_breakdown as Record<string, number>
        validateConfiguredLine({ productSlug: line.product_slug, quantity: line.quantity, sizes, allowedSizes: findCatalogProduct(line.product_slug)?.sizes ?? [], colourType: configuration.colourType as "signature" | "custom_dye" | undefined, artwork: configuration.artwork as never, neckLabel: configuration.neckLabel as never, deliveryType: line.delivery_type as "rush" | "standard" | "flexible" })
        for (const fileId of referencedFileIds(configuration)) {
          const file = await service.retrieveStoredFile(fileId)
          if (file.customer_id !== actorId || file.state !== "finalized" || file.scan_status !== "clean") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "All artwork must be verified and malware-clean before payment")
        }
        authoritativeTotal += priceConfiguredLine({ productSlug: line.product_slug, quantity: line.quantity, colourType: configuration.colourType as "signature" | "custom_dye" | undefined, artwork: configuration.artwork as never, neckLabel: configuration.neckLabel as never, deliveryType: line.delivery_type as "rush" | "standard" | "flexible" }).totalPaise
      }
    } else {
      if (lines.length) throw new MedusaError(MedusaError.Types.CONFLICT, "Configured lines cannot be paid from a sample cart")
      for (const item of cart.items ?? []) authoritativeTotal += samplePrice(String(item.metadata?.garmops_sample_product_slug ?? ""), String(item.metadata?.garmops_sample_size ?? ""), Number(item.quantity)).totalPaise
    }
    if (Number(cart.total) !== authoritativeTotal) throw new MedusaError(MedusaError.Types.CONFLICT, "Cart total is stale; refresh the cart before payment")
    const { result } = await initiatePayuPaymentWorkflow(req.scope).run({ input: { cartId, customerId: actorId, amountPaise: authoritativeTotal, data: { cart_id: cartId, cart_type: profile.cart_type, productinfo: `Garmops ${profile.cart_type} order`, email: cart.email ?? "" } } })
    res.status(201).json({ paymentCollectionId: result.collectionId, paymentSession: result.session, amountPaise: authoritativeTotal, requestId: req.requestId })
  } catch (error) {
    res.status(400).json({ code: "PAYMENT_INITIATION_FAILED", message: error instanceof Error ? error.message : "Payment could not be initiated", requestId: req.requestId })
  }
}

function referencedFileIds(configuration: Record<string, unknown>): string[] {
  const values: unknown[] = [
    (configuration.artwork as Record<string, unknown> | undefined)?.front,
    (configuration.artwork as Record<string, unknown> | undefined)?.back,
    configuration.neckLabel,
  ]
  return values.map((value) => typeof value === "object" && value !== null ? (value as Record<string, unknown>).fileId : undefined).filter((value): value is string => typeof value === "string")
}
