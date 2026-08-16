export type CatalogProduct = {
  slug: string
  name: string
  technicalName: string
  category: string
  selectorCategory: string
  fit?: string
  fabricFeel: string
  material: string
  description: string
  gsm: number
  sizes: readonly string[]
  minimumOrderQuantity: number
  basePriceRupees: number
  image: string | null
  details: readonly string[]
  careInstructions: readonly string[]
  metadata: Record<string, unknown>
  /** HSN heading used for GST invoicing. */
  hsnCode: string
  /** Default GST rate in basis points. Apparel may use the threshold rule below. */
  gstRateBasisPoints: number
  gstRateRule?: "fixed" | "apparel_transaction_value"
  gstHighRateBasisPoints?: number
  gstThresholdPaise?: number
}

const prices: Record<string, number> = {
  "regular-fit-tee-200gsm": 535,
  "boxy-fit-tee-200gsm": 535,
  "regular-fit-tee-260gsm": 565,
  "boxy-fit-tee-260gsm": 565,
  "longsleeve-tee-260gsm": 565,
  "polo-280gsm": 595,
  "canvas-tote-bag": 350,
  "regular-fit-sweatshirt-320gsm": 565,
  "regular-fit-hoodie-320gsm": 575,
  "boxy-fit-hoodie-320gsm": 615,
}

const productTax: Record<string, Pick<CatalogProduct, "hsnCode" | "gstRateBasisPoints" | "gstRateRule" | "gstHighRateBasisPoints" | "gstThresholdPaise">> = {
  "regular-fit-tee-200gsm": { hsnCode: "6109", gstRateBasisPoints: 500, gstRateRule: "apparel_transaction_value", gstHighRateBasisPoints: 1200, gstThresholdPaise: 100000 },
  "boxy-fit-tee-200gsm": { hsnCode: "6109", gstRateBasisPoints: 500, gstRateRule: "apparel_transaction_value", gstHighRateBasisPoints: 1200, gstThresholdPaise: 100000 },
  "regular-fit-tee-260gsm": { hsnCode: "6109", gstRateBasisPoints: 500, gstRateRule: "apparel_transaction_value", gstHighRateBasisPoints: 1200, gstThresholdPaise: 100000 },
  "boxy-fit-tee-260gsm": { hsnCode: "6109", gstRateBasisPoints: 500, gstRateRule: "apparel_transaction_value", gstHighRateBasisPoints: 1200, gstThresholdPaise: 100000 },
  "longsleeve-tee-260gsm": { hsnCode: "6109", gstRateBasisPoints: 500, gstRateRule: "apparel_transaction_value", gstHighRateBasisPoints: 1200, gstThresholdPaise: 100000 },
  "polo-280gsm": { hsnCode: "6105", gstRateBasisPoints: 500, gstRateRule: "apparel_transaction_value", gstHighRateBasisPoints: 1200, gstThresholdPaise: 100000 },
  "canvas-tote-bag": { hsnCode: "4202 22 20", gstRateBasisPoints: 1200, gstRateRule: "fixed" },
  "regular-fit-sweatshirt-320gsm": { hsnCode: "6110", gstRateBasisPoints: 500, gstRateRule: "apparel_transaction_value", gstHighRateBasisPoints: 1200, gstThresholdPaise: 100000 },
  "regular-fit-hoodie-320gsm": { hsnCode: "6110", gstRateBasisPoints: 500, gstRateRule: "apparel_transaction_value", gstHighRateBasisPoints: 1200, gstThresholdPaise: 100000 },
  "boxy-fit-hoodie-320gsm": { hsnCode: "6110", gstRateBasisPoints: 500, gstRateRule: "apparel_transaction_value", gstHighRateBasisPoints: 1200, gstThresholdPaise: 100000 },
}

const product = (input: Omit<CatalogProduct, "basePriceRupees" | "metadata" | "hsnCode" | "gstRateBasisPoints" | "gstRateRule" | "gstHighRateBasisPoints" | "gstThresholdPaise">): CatalogProduct => ({
  ...input,
  ...productTax[input.slug],
  basePriceRupees: prices[input.slug],
  metadata: {
    pricingKey: input.slug,
    productAvailability: "active",
    selectorMetadata: { selectorCategory: input.selectorCategory, fabricFeel: input.fabricFeel },
  },
})

export const CATALOG: readonly CatalogProduct[] = [
  product({ slug: "regular-fit-tee-200gsm", name: "Classic T-Shirt", technicalName: "Regular Fit T-Shirt", category: "T-Shirts", selectorCategory: "T-Shirts", fit: "Classic", fabricFeel: "Everyday weight", material: "100% Cotton", description: "An everyday regular-fit T-shirt with a familiar silhouette for staff apparel, events and versatile merchandise.", gsm: 200, sizes: ["XS", "S", "M", "L", "XL"], minimumOrderQuantity: 50, image: "/products/regular-fit-tee-200gsm.webp", details: ["200 GSM 100% Cotton French Terry", "Regular fit", "Crew neck", "Preshrunk fabric (0-3%)", "Twin needle hem"], careInstructions: ["Machine Wash", "Tumble Dry", "Do not bleach", "Iron on low heat"] }),
  product({ slug: "boxy-fit-tee-200gsm", name: "Relaxed T-Shirt", technicalName: "Boxy Fit T-Shirt", category: "T-Shirts", selectorCategory: "T-Shirts", fit: "Oversized", fabricFeel: "Everyday weight", material: "100% Cotton", description: "A relaxed everyday T-shirt with dropped shoulders and a roomier body for contemporary merchandise.", gsm: 200, sizes: ["XS", "S", "M", "L", "XL"], minimumOrderQuantity: 50, image: "/products/boxy-fit-tee-200gsm.webp", details: ["200 GSM 100% combed cotton", "Boxy oversized fit", "Drop shoulder", "Crew neck", "Preshrunk fabric"], careInstructions: ["Machine Wash", "Tumble Dry", "Do not bleach", "Iron on low heat"] }),
  product({ slug: "regular-fit-tee-260gsm", name: "Premium T-Shirt", technicalName: "Regular Fit Heavyweight T-Shirt", category: "T-Shirts", selectorCategory: "T-Shirts", fit: "Classic", fabricFeel: "Heavyweight & structured", material: "100% Cotton", description: "A heavyweight regular-fit T-shirt with a more substantial hand feel while retaining a familiar straight silhouette.", gsm: 260, sizes: ["XS", "S", "M", "L", "XL"], minimumOrderQuantity: 50, image: "/products/regular-fit-tee-260gsm.webp", details: ["260 GSM 100% combed cotton", "Regular fit", "Crew neck", "Preshrunk fabric", "Reinforced seams"], careInstructions: ["Machine Wash", "Tumble Dry", "Do not bleach", "Iron on low heat"] }),
  product({ slug: "boxy-fit-tee-260gsm", name: "Premium Oversized T-Shirt", technicalName: "Boxy Fit Heavyweight T-Shirt", category: "T-Shirts", selectorCategory: "T-Shirts", fit: "Oversized", fabricFeel: "Heavyweight & structured", material: "100% Cotton", description: "A heavyweight oversized T-shirt with dropped shoulders and a structured body for premium merchandise and branded drops.", gsm: 260, sizes: ["XS", "S", "M", "L", "XL"], minimumOrderQuantity: 50, image: "/products/boxy-fit-tee-260gsm.webp", details: ["260 GSM 100% combed cotton", "Boxy oversized fit", "Drop shoulder", "Crew neck", "Reinforced seams"], careInstructions: ["Machine Wash", "Tumble Dry", "Do not bleach", "Iron on low heat"] }),
  product({ slug: "longsleeve-tee-260gsm", name: "Long Sleeve T-Shirt", technicalName: "Longsleeve Tee", category: "Longsleeve", selectorCategory: "T-Shirts", fit: "Classic", fabricFeel: "Heavyweight & structured", material: "100% Cotton", description: "A heavyweight long-sleeve T-shirt with a regular straight-cut fit and ribbed cuffs.", gsm: 260, sizes: ["S", "M", "L", "XL", "XXL"], minimumOrderQuantity: 50, image: "/products/longsleeve-tee-260gsm.webp", details: ["260 GSM 100% combed cotton", "Regular fit", "Long sleeves", "Crew neck", "Ribbed cuffs"], careInstructions: ["Machine Wash", "Tumble Dry", "Do not bleach"] }),
  product({ slug: "polo-280gsm", name: "Polo T-Shirt", technicalName: "Polo", category: "Polos", selectorCategory: "Polos", fit: "Classic", fabricFeel: "Structured piqué", material: "Cotton Piqué", description: "A structured cotton-piqué polo with a regular fit for staff uniforms, teams and customer-facing apparel.", gsm: 280, sizes: ["XS", "S", "M", "L", "XL", "XXL"], minimumOrderQuantity: 50, image: "/products/polo-tee.webp", details: ["280 GSM cotton pique", "Regular fit", "Ribbed polo collar", "Button placket", "Preshrunk fabric"], careInstructions: ["Machine Wash", "Tumble Dry", "Do not bleach", "Iron on low heat"] }),
  product({ slug: "canvas-tote-bag", name: "Canvas Tote Bag", technicalName: "Canvas Tote Bag", category: "Accessories", selectorCategory: "Tote Bags", fit: "One size", fabricFeel: "Sturdy heavy canvas", material: "Natural Canvas", description: "A sturdy 12 oz natural-canvas tote with reinforced handles and a gusseted base for branded merchandise and event use.", gsm: 340, sizes: ["One Size"], minimumOrderQuantity: 50, image: "/products/canvas-tote-bag.webp", details: ["12oz (340 GSM) natural canvas", "Reinforced 24\" handles", "Gusset base", "38cm x 42cm body"], careInstructions: ["Hand Wash", "Air Dry", "Do not Machine Wash", "Iron on Low"] }),
  product({ slug: "regular-fit-sweatshirt-320gsm", name: "Classic Sweatshirt", technicalName: "Regular Fit Sweatshirt", category: "Sweatshirts", selectorCategory: "Sweatshirts", fit: "Classic", fabricFeel: "Warm brushed fleece", material: "Cotton-Poly Fleece", description: "A warm crewneck sweatshirt with a regular fit, ribbed finishes and a brushed fleece interior.", gsm: 320, sizes: ["S", "M", "L", "XL", "XXL"], minimumOrderQuantity: 50, image: "/products/regular-fit-sweatshirt-320gsm.webp", details: ["320 GSM 80/20 cotton-poly fleece", "Regular fit", "Crewneck collar", "Ribbed cuffs and hem", "Brushed inner fleece"], careInstructions: ["Machine Wash", "Tumble Dry", "Do not bleach", "Iron on low heat"] }),
  product({ slug: "regular-fit-hoodie-320gsm", name: "Classic Hoodie", technicalName: "Regular Fit Hoodie", category: "Hoodies", selectorCategory: "Hoodies", fit: "Classic", fabricFeel: "Warm brushed fleece", material: "Cotton-Poly Fleece", description: "A warm regular-fit pullover hoodie with a kangaroo pocket and structured hood for teams and company merchandise.", gsm: 320, sizes: ["S", "M", "L", "XL", "XXL"], minimumOrderQuantity: 50, image: "/products/regular-fit-hoodie-320gsm.webp", details: ["320 GSM 80/20 cotton-poly fleece", "Regular fit", "Kangaroo pocket", "Structured hood with drawcord", "Ribbed cuffs and hem"], careInstructions: ["Machine Wash", "Tumble Dry", "Do not bleach", "Iron on low heat"] }),
  product({ slug: "boxy-fit-hoodie-320gsm", name: "Oversized Hoodie", technicalName: "Boxy Fit Hoodie", category: "Hoodies", selectorCategory: "Hoodies", fit: "Oversized", fabricFeel: "Warm brushed fleece", material: "Cotton-Poly Fleece", description: "A warm oversized pullover hoodie with dropped shoulders and a roomier silhouette for modern branded merchandise.", gsm: 320, sizes: ["S", "M", "L", "XL"], minimumOrderQuantity: 50, image: "/products/boxy-fit-hoodie-320gsm.webp", details: ["320 GSM 80/20 cotton-poly fleece", "Boxy oversized fit", "Drop shoulder", "Kangaroo pocket", "Oversized hood with drawcord"], careInstructions: ["Machine Wash", "Tumble Dry", "Do not bleach"] }),
]

export const SIGNATURE_COLOURS = [
  { id: "jet-black", name: "Jet Black", hex: "#161616" },
  { id: "classic-white", name: "Classic White", hex: "#F5F5F2" },
  { id: "navy-blue", name: "Navy Blue", hex: "#202C46" },
  { id: "charcoal-grey", name: "Charcoal Grey", hex: "#414345" },
  { id: "heather-grey", name: "Heather Grey", hex: "#B6B7B4" },
  { id: "bottle-green", name: "Bottle Green", hex: "#234936" },
  { id: "burgundy", name: "Burgundy", hex: "#722F3D" },
  { id: "sand", name: "Sand", hex: "#D2C2A8" },
] as const

export const REFLECTIVE_COLOURS = [
  { key: "silver", label: "Silver", hex: "#9B9EA1" },
  { key: "gold", label: "Gold", hex: "#9C7B43" },
  { key: "red", label: "Red", hex: "#D0021B" },
  { key: "neon_pink", label: "Neon Pink", hex: "#FF35A4" },
  { key: "neon_yellow", label: "Neon Yellow", hex: "#E9F000" },
  { key: "white", label: "White", hex: "#F7F7F5" },
  { key: "black", label: "Black", hex: "#111111" },
  { key: "royal_blue", label: "Royal Blue", hex: "#245B91" },
  { key: "green", label: "Green", hex: "#398A68" },
] as const

export const PRINT_TECHNIQUES = {
  screen_print: { label: "Screen Print", deltaRupees: 38 },
  dtf: { label: "DTF", deltaRupees: 32 },
  reflective_print: { label: "Reflective Print", deltaRupees: 46 },
} as const

export function findCatalogProduct(slug: string): CatalogProduct | undefined {
  return CATALOG.find((item) => item.slug === slug)
}
