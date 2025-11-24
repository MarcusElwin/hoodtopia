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
export { productData };

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
    const imageUrl = `/images/products/${slug}-black.png`;

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
        const imageUrl = `/images/products/${product.slug}-${colorSlug}.png`;

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

  console.log(`\n✅ Seed complete!`);
  console.log(`   Products: ${insertedProducts.length}`);
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
