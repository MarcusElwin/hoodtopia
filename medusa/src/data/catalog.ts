/**
 * Hoodtopia catalog data, ported verbatim from the storefront's old Drizzle
 * seed (src/db/seed.ts). This is the single source of catalog truth the Medusa
 * seed script consumes. Keeping it as plain data (no DB calls) makes it easy to
 * diff against the original and reuse from tests.
 *
 * Prices: `basePrice` is in USD **cents** (e.g. 5999 = $59.99), exactly as the
 * old schema stored it. The seed script expands this into a Medusa price set
 * across the 5 currencies Hoodtopia sells in (see PRICED_CURRENCIES below).
 */

export interface HoodieDef {
  name: string
  slug: string
  description: string
  /** USD cents. */
  basePrice: number
  category: string
  featured: boolean
  material: string
  /** Feature bullet list. */
  features: string[]
}

export interface AccessoryDef extends HoodieDef {}

// ── Hoodies (color × size variants) ─────────────────────────────────────────
export const hoodies: HoodieDef[] = [
  {
    name: "Classic Comfort Hoodie",
    slug: "classic-comfort-hoodie",
    description:
      "The perfect everyday hoodie. Made with an ultra-soft cotton blend that feels like a warm hug. Features a relaxed fit, kangaroo pocket, and ribbed cuffs for timeless comfort.",
    basePrice: 5999,
    category: "casual",
    featured: true,
    material: "80% cotton, 20% polyester",
    features: [
      "Soft inner fleece lining",
      "Ribbed cuffs and hem",
      "Kangaroo pocket",
      "Relaxed fit",
      "Pre-shrunk fabric",
    ],
  },
  {
    name: "Tech Fleece Pro",
    slug: "tech-fleece-pro",
    description:
      "Engineered for performance. Our Tech Fleece Pro combines innovative thermal regulation with moisture-wicking technology. Perfect for workouts or cool weather adventures.",
    basePrice: 8999,
    category: "performance",
    featured: true,
    material: "Technical fleece blend (65% polyester, 35% cotton)",
    features: [
      "Moisture-wicking fabric",
      "Temperature regulation",
      "Thumbholes in cuffs",
      "Zippered side pockets",
      "Athletic fit",
      "Flatlock seams",
    ],
  },
  {
    name: "Athletic Performance Hoodie",
    slug: "athletic-performance-hoodie",
    description:
      "Built for movement. Lightweight, breathable, and equipped with reflective details for visibility. Your go-to hoodie for running, training, or active lifestyles.",
    basePrice: 7999,
    category: "athletic",
    featured: false,
    material: "100% lightweight polyester",
    features: [
      "Breathable mesh panels",
      "Reflective details",
      "Quick-dry technology",
      "Lightweight construction",
      "Four-way stretch",
      "Media pocket with cord port",
    ],
  },
  {
    name: "Oversized Street Hoodie",
    slug: "oversized-street-hoodie",
    description:
      "Make a statement. This oversized silhouette brings urban edge to your wardrobe with dropped shoulders, extended length, and premium heavyweight cotton.",
    basePrice: 6999,
    category: "streetwear",
    featured: true,
    material: "100% heavyweight cotton",
    features: [
      "Dropped shoulders",
      "Extended length",
      "Oversized fit",
      "Reinforced stitching",
      "Extra-large hood",
      "Embroidered logo",
    ],
  },
  {
    name: "Premium Zip-Up",
    slug: "premium-zip-up",
    description:
      "Minimalist luxury meets everyday function. Features a smooth YKK zipper, clean lines, and premium cotton blend for understated elegance.",
    basePrice: 9999,
    category: "premium",
    featured: false,
    material: "Premium cotton blend (70% cotton, 30% modal)",
    features: [
      "YKK premium zipper",
      "Two side pockets",
      "Minimalist design",
      "Slim fit",
      "Soft-touch finish",
      "Metal zipper pulls",
    ],
  },
  {
    name: "Heavyweight Winter Hoodie",
    slug: "heavyweight-winter-hoodie",
    description:
      "Conquer the cold. Double-layered fleece construction provides maximum warmth without bulk. Wind-resistant and built for the harshest winter conditions.",
    basePrice: 10999,
    category: "outdoor",
    featured: true,
    material: "Double-layered fleece (100% polyester outer, fleece inner)",
    features: [
      "Wind-resistant outer layer",
      "Extra thick fleece lining",
      "Adjustable hood with drawcord",
      "Hand-warmer pockets",
      "Extended back hem",
      "Thermal insulation",
    ],
  },
]

// ── Accessories (single "One Size" variant) ─────────────────────────────────
export const accessories: AccessoryDef[] = [
  {
    name: "Hoodtopia Logo Sticker Pack",
    slug: "logo-sticker-pack",
    description:
      "Express yourself with our premium vinyl sticker pack. Includes 5 unique Hoodtopia designs - perfect for laptops, water bottles, or anywhere you want to show your style.",
    basePrice: 999,
    category: "stickers",
    featured: false,
    material: "Premium waterproof vinyl",
    features: [
      "5 unique designs",
      "Waterproof & UV resistant",
      "Dishwasher safe",
      "Easy peel backing",
      "3-4 inch sizes",
    ],
  },
  {
    name: "Holographic Hoodie Stickers",
    slug: "holographic-stickers",
    description:
      "Eye-catching holographic stickers that shimmer and shine. Features hoodie-themed designs with a premium iridescent finish.",
    basePrice: 1299,
    category: "stickers",
    featured: false,
    material: "Holographic vinyl",
    features: [
      "3 holographic designs",
      "Rainbow shimmer effect",
      "Scratch resistant",
      "Indoor/outdoor use",
      "Premium adhesive",
    ],
  },
  {
    name: "Enamel Pin Set",
    slug: "enamel-pin-set",
    description:
      "Collectible enamel pins to customize your hoodie or bag. This set includes 3 beautifully crafted pins with secure butterfly clutch backs.",
    basePrice: 1999,
    category: "pins",
    featured: true,
    material: "Hard enamel with gold plating",
    features: [
      "3 unique pin designs",
      "Hard enamel finish",
      "Gold-plated metal",
      "Butterfly clutch backs",
      "Collectible quality",
    ],
  },
  {
    name: "Hoodie Love Pin",
    slug: "hoodie-love-pin",
    description:
      "Show your hoodie love with this adorable enamel pin featuring a heart-shaped hoodie design. Perfect for true hoodie enthusiasts.",
    basePrice: 899,
    category: "pins",
    featured: false,
    material: "Soft enamel with silver plating",
    features: [
      "Heart-hoodie design",
      "Soft enamel fill",
      "Silver-plated metal",
      "Rubber clutch back",
      "1.25 inch size",
    ],
  },
  {
    name: "Iron-On Patch Collection",
    slug: "iron-on-patches",
    description:
      "Transform your hoodie with our embroidered iron-on patches. Set of 4 unique designs that add instant personality to any garment.",
    basePrice: 1499,
    category: "patches",
    featured: true,
    material: "Embroidered twill with iron-on backing",
    features: [
      "4 embroidered patches",
      "Iron-on application",
      "Can also be sewn",
      "Durable construction",
      "Various sizes included",
    ],
  },
  {
    name: "Chenille Letter Patch",
    slug: "chenille-letter-patch",
    description:
      "Varsity-style chenille patch featuring the iconic 'H' for Hoodtopia. Add a retro collegiate vibe to your favorite hoodie.",
    basePrice: 1299,
    category: "patches",
    featured: false,
    material: "Chenille with felt backing",
    features: [
      "Varsity 'H' design",
      "Soft chenille texture",
      "Sew-on application",
      "4 inch height",
      "Classic letterman style",
    ],
  },
  {
    name: "Mini Hoodie Keychain",
    slug: "mini-hoodie-keychain",
    description:
      "An adorable miniature hoodie keychain that's the perfect accessory for your keys, bag, or backpack. Super soft and squeezable!",
    basePrice: 1499,
    category: "accessories",
    featured: true,
    material: "Soft plush with metal clasp",
    features: [
      "3 inch mini hoodie",
      "Ultra-soft plush material",
      "Sturdy metal lobster clasp",
      "Squeezable & cuddly",
      "Purple Hoodtopia color",
    ],
  },
  {
    name: "Cozy Club Socks",
    slug: "cozy-club-socks",
    description:
      "Complete your cozy look with our ultra-soft crew socks featuring fun hoodie-inspired patterns. Because comfort shouldn't stop at your ankles.",
    basePrice: 1699,
    category: "apparel",
    featured: false,
    material: "80% combed cotton, 17% polyester, 3% spandex",
    features: [
      "Hoodie pattern design",
      "Cushioned footbed",
      "Reinforced heel & toe",
      "Stay-up ribbed cuff",
      "One size fits most",
    ],
  },
  {
    name: "Rainbow Drawstring Set",
    slug: "rainbow-drawstring-set",
    description:
      "Upgrade your hoodie's look with our premium replacement drawstrings. Set includes 4 vibrant colors to match any mood or outfit.",
    basePrice: 1199,
    category: "accessories",
    featured: false,
    material: "Braided cotton cord with metal aglets",
    features: [
      "4 color options included",
      "Premium braided cotton",
      "Metal aglet tips",
      "Universal 52 inch length",
      "Easy to install",
    ],
  },
  {
    name: "Hoodtopia Canvas Tote",
    slug: "canvas-tote-bag",
    description:
      "A sturdy canvas tote bag featuring our iconic hoodie illustration. Perfect for groceries, books, or carrying your favorite hoodie when it gets too warm.",
    basePrice: 2499,
    category: "bags",
    featured: true,
    material: "12oz organic cotton canvas",
    features: [
      "Large 15x16 inch size",
      "Reinforced handles",
      "Interior pocket",
      "Screen-printed design",
      "Eco-friendly materials",
    ],
  },
  {
    name: "Hoodie Care Kit",
    slug: "hoodie-care-kit",
    description:
      "Keep your hoodies looking fresh with our essential care kit. Includes fabric refresher spray, travel lint roller, and a microfiber cleaning cloth.",
    basePrice: 1999,
    category: "care",
    featured: false,
    material: "Various",
    features: [
      "Fabric refresher spray (4oz)",
      "Travel-size lint roller",
      "Microfiber cloth",
      "Care instruction card",
      "Reusable zip pouch",
    ],
  },
  {
    name: "Glow-in-Dark Pin",
    slug: "glow-pin",
    description:
      "A magical glow-in-the-dark enamel pin shaped like a cozy hoodie. Charges in light and glows bright green in the dark!",
    basePrice: 1099,
    category: "pins",
    featured: false,
    material: "Hard enamel with glow pigment",
    features: [
      "Glows in the dark",
      "Hoodie silhouette design",
      "Charges in any light",
      "1.5 inch size",
      "Double-post back",
    ],
  },
  {
    name: "Hoodie Shaped Mug",
    slug: "hoodie-mug",
    description:
      "Start your mornings right with this adorable hoodie-shaped ceramic mug. The handle looks like a sleeve, and it even has a tiny pocket detail!",
    basePrice: 2199,
    category: "home",
    featured: true,
    material: "Ceramic with food-safe glaze",
    features: [
      "14oz capacity",
      "Hoodie sleeve handle",
      "Raised pocket detail",
      "Microwave safe",
      "Dishwasher safe",
    ],
  },
]

// ── Hoodie variant axes ─────────────────────────────────────────────────────
export const colors: { name: string; hex: string }[] = [
  { name: "Black", hex: "#000000" },
  { name: "Navy", hex: "#1e3a5f" },
  { name: "Heather Gray", hex: "#9ca3af" },
  { name: "Forest Green", hex: "#166534" },
  { name: "Burgundy", hex: "#7f1d1d" },
  { name: "Royal Blue", hex: "#1d4ed8" },
  { name: "Charcoal", hex: "#374151" },
  { name: "Cream", hex: "#fef3c7" },
]

export const sizes = ["XS", "S", "M", "L", "XL", "XXL"]

// Hoodtopia brand purple — the single colour used for accessory variants.
export const ACCESSORY_COLOR = { name: "Default", hex: "#a855f7" }

// ── Deterministic stock buckets (ported verbatim) ───────────────────────────
// ~80% well-stocked, ~15% medium, ~5% scarce so the demo always has a few
// "Only X left" SKUs, and reseeds reproduce the same scarcity story.
export function stockBucket(key: string): "scarce" | "medium" | "well" {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  const r = h % 100
  if (r < 5) return "scarce"
  if (r < 20) return "medium"
  return "well"
}

/** Hoodie variant stock, keyed by `${slug}:${sku}` (ported from old seed). */
export function hoodieStock(slug: string, sku: string): number {
  const bucket = stockBucket(`${slug}:${sku}`)
  if (bucket === "scarce") return 1 + ((sku.charCodeAt(0) + sku.charCodeAt(1)) % 5)
  if (bucket === "medium") return 10 + (sku.charCodeAt(0) % 21)
  return 50 + (sku.charCodeAt(1) % 51)
}

/** Accessory stock, keyed by `acc:${slug}` (ported from old seed). */
export function accessoryStock(slug: string, sku: string): number {
  const bucket = stockBucket(`acc:${slug}`)
  if (bucket === "scarce") return 1 + (sku.charCodeAt(4) % 5)
  if (bucket === "medium") return 10 + (sku.charCodeAt(4) % 21)
  return 50 + (sku.charCodeAt(4) % 51)
}

// ── SKU helpers (match the old seed's format so Kustom order_lines line up) ──
export function hoodieSku(slug: string, colorName: string, size: string): string {
  const colorSlug = colorName.toLowerCase().replace(/ /g, "-")
  return `${slug.toUpperCase().slice(0, 3)}-${colorSlug.toUpperCase().slice(0, 3)}-${size}`
}

export function accessorySku(slug: string): string {
  return `ACC-${slug.replace(/-/g, "").toUpperCase().slice(0, 12)}-OS`
}

// ── Image paths (reused as-is from the storefront /public) ──────────────────
export function hoodieImage(slug: string, colorName: string): string {
  const colorSlug = colorName.toLowerCase().replace(/ /g, "-")
  return `/images/products/${slug}-${colorSlug}.jpg`
}

export function accessoryImage(slug: string): string {
  return `/images/accessories/${slug}.jpg`
}

// ── Multi-currency pricing ──────────────────────────────────────────────────
// The old catalog stored a single USD-cents price. Hoodtopia sells in 5
// markets (see src/lib/kustom/markets.ts). We derive each currency from the USD
// base with fixed demo FX rates — good enough for a demo, deterministic, and
// keeps SEK/JPY round-ish. Amounts are returned in MAJOR units (Medusa stores
// decimal amounts; e.g. 59.99 USD, 649 SEK, 6900 JPY).
export const PRICED_CURRENCIES = ["usd", "sek", "gbp", "eur", "jpy"] as const
export type PricedCurrency = (typeof PRICED_CURRENCIES)[number]

// Demo FX vs 1 USD. JPY/SEK rounded to whole units (no minor unit for JPY).
const FX: Record<PricedCurrency, number> = {
  usd: 1,
  sek: 10.8,
  gbp: 0.79,
  eur: 0.92,
  jpy: 150,
}

/** Build a Medusa `prices[]` array (major units) from a USD-cents base price. */
export function pricesFromUsdCents(
  usdCents: number
): { currency_code: PricedCurrency; amount: number }[] {
  const usd = usdCents / 100
  return PRICED_CURRENCIES.map((cc) => {
    const raw = usd * FX[cc]
    // JPY/SEK to whole units; USD/GBP/EUR to 2 decimals.
    const amount = cc === "jpy" || cc === "sek" ? Math.round(raw) : Math.round(raw * 100) / 100
    return { currency_code: cc, amount }
  })
}
