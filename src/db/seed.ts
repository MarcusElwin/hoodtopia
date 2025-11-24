import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import * as schema from "./schema";

const sqlite = new Database("./db/hoodtopia.db");
const db = drizzle(sqlite, { schema });

// Product definitions
const productData = [
  {
    name: "Classic Comfort Hoodie",
    slug: "classic-comfort-hoodie",
    description:
      "The perfect everyday hoodie. Made with an ultra-soft cotton blend that feels like a warm hug. Features a relaxed fit, kangaroo pocket, and ribbed cuffs for timeless comfort.",
    basePrice: 5999, // $59.99
    category: "casual",
    featured: true,
    material: "80% cotton, 20% polyester",
    features: JSON.stringify([
      "Soft inner fleece lining",
      "Ribbed cuffs and hem",
      "Kangaroo pocket",
      "Relaxed fit",
      "Pre-shrunk fabric",
    ]),
  },
  {
    name: "Tech Fleece Pro",
    slug: "tech-fleece-pro",
    description:
      "Engineered for performance. Our Tech Fleece Pro combines innovative thermal regulation with moisture-wicking technology. Perfect for workouts or cool weather adventures.",
    basePrice: 8999, // $89.99
    category: "performance",
    featured: true,
    material: "Technical fleece blend (65% polyester, 35% cotton)",
    features: JSON.stringify([
      "Moisture-wicking fabric",
      "Temperature regulation",
      "Thumbholes in cuffs",
      "Zippered side pockets",
      "Athletic fit",
      "Flatlock seams",
    ]),
  },
  {
    name: "Athletic Performance Hoodie",
    slug: "athletic-performance-hoodie",
    description:
      "Built for movement. Lightweight, breathable, and equipped with reflective details for visibility. Your go-to hoodie for running, training, or active lifestyles.",
    basePrice: 7999, // $79.99
    category: "athletic",
    featured: false,
    material: "100% lightweight polyester",
    features: JSON.stringify([
      "Breathable mesh panels",
      "Reflective details",
      "Quick-dry technology",
      "Lightweight construction",
      "Four-way stretch",
      "Media pocket with cord port",
    ]),
  },
  {
    name: "Oversized Street Hoodie",
    slug: "oversized-street-hoodie",
    description:
      "Make a statement. This oversized silhouette brings urban edge to your wardrobe with dropped shoulders, extended length, and premium heavyweight cotton.",
    basePrice: 6999, // $69.99
    category: "streetwear",
    featured: true,
    material: "100% heavyweight cotton",
    features: JSON.stringify([
      "Dropped shoulders",
      "Extended length",
      "Oversized fit",
      "Reinforced stitching",
      "Extra-large hood",
      "Embroidered logo",
    ]),
  },
  {
    name: "Premium Zip-Up",
    slug: "premium-zip-up",
    description:
      "Minimalist luxury meets everyday function. Features a smooth YKK zipper, clean lines, and premium cotton blend for understated elegance.",
    basePrice: 9999, // $99.99
    category: "premium",
    featured: false,
    material: "Premium cotton blend (70% cotton, 30% modal)",
    features: JSON.stringify([
      "YKK premium zipper",
      "Two side pockets",
      "Minimalist design",
      "Slim fit",
      "Soft-touch finish",
      "Metal zipper pulls",
    ]),
  },
  {
    name: "Heavyweight Winter Hoodie",
    slug: "heavyweight-winter-hoodie",
    description:
      "Conquer the cold. Double-layered fleece construction provides maximum warmth without bulk. Wind-resistant and built for the harshest winter conditions.",
    basePrice: 10999, // $109.99
    category: "outdoor",
    featured: true,
    material: "Double-layered fleece (100% polyester outer, fleece inner)",
    features: JSON.stringify([
      "Wind-resistant outer layer",
      "Extra thick fleece lining",
      "Adjustable hood with drawcord",
      "Hand-warmer pockets",
      "Extended back hem",
      "Thermal insulation",
    ]),
  },
];

// Accessory products (no color variants, single items)
const accessoryData = [
  {
    name: "Hoodtopia Logo Sticker Pack",
    slug: "logo-sticker-pack",
    description:
      "Express yourself with our premium vinyl sticker pack. Includes 5 unique Hoodtopia designs - perfect for laptops, water bottles, or anywhere you want to show your style.",
    basePrice: 999, // $9.99
    category: "stickers",
    featured: false,
    material: "Premium waterproof vinyl",
    features: JSON.stringify([
      "5 unique designs",
      "Waterproof & UV resistant",
      "Dishwasher safe",
      "Easy peel backing",
      "3-4 inch sizes",
    ]),
  },
  {
    name: "Holographic Hoodie Stickers",
    slug: "holographic-stickers",
    description:
      "Eye-catching holographic stickers that shimmer and shine. Features hoodie-themed designs with a premium iridescent finish.",
    basePrice: 1299, // $12.99
    category: "stickers",
    featured: false,
    material: "Holographic vinyl",
    features: JSON.stringify([
      "3 holographic designs",
      "Rainbow shimmer effect",
      "Scratch resistant",
      "Indoor/outdoor use",
      "Premium adhesive",
    ]),
  },
  {
    name: "Enamel Pin Set",
    slug: "enamel-pin-set",
    description:
      "Collectible enamel pins to customize your hoodie or bag. This set includes 3 beautifully crafted pins with secure butterfly clutch backs.",
    basePrice: 1999, // $19.99
    category: "pins",
    featured: true,
    material: "Hard enamel with gold plating",
    features: JSON.stringify([
      "3 unique pin designs",
      "Hard enamel finish",
      "Gold-plated metal",
      "Butterfly clutch backs",
      "Collectible quality",
    ]),
  },
  {
    name: "Hoodie Love Pin",
    slug: "hoodie-love-pin",
    description:
      "Show your hoodie love with this adorable enamel pin featuring a heart-shaped hoodie design. Perfect for true hoodie enthusiasts.",
    basePrice: 899, // $8.99
    category: "pins",
    featured: false,
    material: "Soft enamel with silver plating",
    features: JSON.stringify([
      "Heart-hoodie design",
      "Soft enamel fill",
      "Silver-plated metal",
      "Rubber clutch back",
      "1.25 inch size",
    ]),
  },
  {
    name: "Iron-On Patch Collection",
    slug: "iron-on-patches",
    description:
      "Transform your hoodie with our embroidered iron-on patches. Set of 4 unique designs that add instant personality to any garment.",
    basePrice: 1499, // $14.99
    category: "patches",
    featured: true,
    material: "Embroidered twill with iron-on backing",
    features: JSON.stringify([
      "4 embroidered patches",
      "Iron-on application",
      "Can also be sewn",
      "Durable construction",
      "Various sizes included",
    ]),
  },
  {
    name: "Chenille Letter Patch",
    slug: "chenille-letter-patch",
    description:
      "Varsity-style chenille patch featuring the iconic 'H' for Hoodtopia. Add a retro collegiate vibe to your favorite hoodie.",
    basePrice: 1299, // $12.99
    category: "patches",
    featured: false,
    material: "Chenille with felt backing",
    features: JSON.stringify([
      "Varsity 'H' design",
      "Soft chenille texture",
      "Sew-on application",
      "4 inch height",
      "Classic letterman style",
    ]),
  },
];

// Color options
export const colors = [
  { name: "Black", hex: "#000000" },
  { name: "Navy", hex: "#1e3a5f" },
  { name: "Heather Gray", hex: "#9ca3af" },
  { name: "Forest Green", hex: "#166534" },
  { name: "Burgundy", hex: "#7f1d1d" },
  { name: "Royal Blue", hex: "#1d4ed8" },
  { name: "Charcoal", hex: "#374151" },
  { name: "Cream", hex: "#fef3c7" },
];

// Size options
export const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

// Export product data for image generation script
export { productData, accessoryData };

async function seed() {
  console.log("🌱 Starting seed...\n");

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  db.delete(schema.cartItems).run();
  db.delete(schema.carts).run();
  db.delete(schema.productVariants).run();
  db.delete(schema.products).run();

  // Insert products
  console.log("📦 Inserting products...");
  const insertedProducts: schema.Product[] = [];

  for (const product of productData) {
    const id = uuidv4();
    const slug = product.slug;
    // Default image URL (will be replaced by Gemini-generated images)
    const imageUrl = `/images/products/${slug}-black.jpg`;

    db.insert(schema.products)
      .values({
        id,
        name: product.name,
        slug,
        description: product.description,
        basePrice: product.basePrice,
        imageUrl,
        category: product.category,
        featured: product.featured,
        material: product.material,
        features: product.features,
      })
      .run();

    insertedProducts.push({
      id,
      name: product.name,
      slug,
      description: product.description,
      basePrice: product.basePrice,
      imageUrl,
      category: product.category,
      featured: product.featured,
      material: product.material,
      features: product.features,
      createdAt: new Date(),
    });

    console.log(`  ✓ ${product.name}`);
  }

  // Insert variants for each product
  console.log("\n🎨 Generating variants...");
  let variantCount = 0;

  for (const product of insertedProducts) {
    for (const color of colors) {
      for (const size of sizes) {
        const variantId = uuidv4();
        const colorSlug = color.name.toLowerCase().replace(/ /g, "-");
        const sku = `${product.slug.toUpperCase().slice(0, 3)}-${colorSlug.toUpperCase().slice(0, 3)}-${size}`;
        const imageUrl = `/images/products/${product.slug}-${colorSlug}.jpg`;

        db.insert(schema.productVariants)
          .values({
            id: variantId,
            productId: product.id,
            color: color.name,
            colorHex: color.hex,
            size,
            stock: Math.floor(Math.random() * 50) + 10, // Random stock 10-60
            imageUrl,
            sku,
          })
          .run();

        variantCount++;
      }
    }
    console.log(`  ✓ ${product.name}: ${colors.length * sizes.length} variants`);
  }

  // Insert accessories
  console.log("\n🎁 Inserting accessories...");
  const insertedAccessories: schema.Product[] = [];

  for (const accessory of accessoryData) {
    const id = uuidv4();
    const slug = accessory.slug;
    const imageUrl = `/images/accessories/${slug}.jpg`;

    db.insert(schema.products)
      .values({
        id,
        name: accessory.name,
        slug,
        description: accessory.description,
        basePrice: accessory.basePrice,
        imageUrl,
        category: accessory.category,
        featured: accessory.featured,
        material: accessory.material,
        features: accessory.features,
      })
      .run();

    insertedAccessories.push({
      id,
      name: accessory.name,
      slug,
      description: accessory.description,
      basePrice: accessory.basePrice,
      imageUrl,
      category: accessory.category,
      featured: accessory.featured,
      material: accessory.material,
      features: accessory.features,
      createdAt: new Date(),
    });

    // Accessories have a single "One Size" variant
    const variantId = uuidv4();
    const sku = `${slug.toUpperCase().slice(0, 6)}-OS`;

    db.insert(schema.productVariants)
      .values({
        id: variantId,
        productId: id,
        color: "Default",
        colorHex: "#a855f7", // Purple for Hoodtopia brand
        size: "One Size",
        stock: Math.floor(Math.random() * 100) + 20,
        imageUrl,
        sku,
      })
      .run();

    variantCount++;
    console.log(`  ✓ ${accessory.name}`);
  }

  console.log(`\n✅ Seed complete!`);
  console.log(`   Hoodies: ${insertedProducts.length}`);
  console.log(`   Accessories: ${insertedAccessories.length}`);
  console.log(`   Total Products: ${insertedProducts.length + insertedAccessories.length}`);
  console.log(`   Variants: ${variantCount}`);
  console.log(`   Colors: ${colors.length}`);
  console.log(`   Sizes: ${sizes.length}`);
}

seed()
  .then(() => {
    console.log("\n🎉 Database seeded successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
