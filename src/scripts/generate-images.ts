import * as dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// Product and color data
const productData = [
  {
    name: "Classic Comfort Hoodie",
    slug: "classic-comfort-hoodie",
    category: "casual",
    style: "relaxed fit, soft cotton, comfortable everyday pullover hoodie",
  },
  {
    name: "Tech Fleece Pro",
    slug: "tech-fleece-pro",
    category: "performance",
    style: "athletic fit, technical fleece, sleek modern performance hoodie",
  },
  {
    name: "Athletic Performance Hoodie",
    slug: "athletic-performance-hoodie",
    category: "athletic",
    style: "lightweight, breathable mesh panels, sporty athletic hoodie",
  },
  {
    name: "Oversized Street Hoodie",
    slug: "oversized-street-hoodie",
    category: "streetwear",
    style: "oversized fit, dropped shoulders, urban streetwear hoodie",
  },
  {
    name: "Premium Zip-Up",
    slug: "premium-zip-up",
    category: "premium",
    style: "minimalist full-zip hoodie, clean lines, premium luxury design",
  },
  {
    name: "Heavyweight Winter Hoodie",
    slug: "heavyweight-winter-hoodie",
    category: "outdoor",
    style: "thick heavyweight, insulated, rugged outdoor winter hoodie",
  },
];

const colors = [
  { name: "Black", hex: "#000000" },
  { name: "Navy", hex: "#1e3a5f" },
  { name: "Heather Gray", hex: "#9ca3af" },
  { name: "Forest Green", hex: "#166534" },
  { name: "Burgundy", hex: "#7f1d1d" },
  { name: "Royal Blue", hex: "#1d4ed8" },
  { name: "Charcoal", hex: "#374151" },
  { name: "Cream", hex: "#fef3c7" },
];

// Get API key from environment (supports multiple env var names)
const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("❌ No API key found. Set one of: GOOGLE_AI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY");
  process.exit(1);
}

// Initialize Gemini with Nano Banana Pro for 4K quality
const ai = new GoogleGenAI({ apiKey });

// Using Gemini 3 Pro Image Preview for highest quality
const IMAGE_MODEL = "gemini-3-pro-image-preview";

// Output directory
const OUTPUT_DIR = path.join(process.cwd(), "public/images/products");

interface GenerationResult {
  product: string;
  color: string;
  success: boolean;
  path?: string;
  error?: string;
}

async function generateProductImage(
  productName: string,
  productSlug: string,
  style: string,
  colorName: string,
  colorHex: string
): Promise<GenerationResult> {
  const colorSlug = colorName.toLowerCase().replace(/ /g, "-");

  const prompt = `Professional e-commerce product photograph of a ${style}.

The hoodie color is ${colorName} (${colorHex}).

Photography requirements:
- Clean white to light gray gradient studio background
- Professional soft-box lighting, even and flattering
- Front view with slight 3/4 angle
- Displayed on invisible mannequin or ghost mannequin style
- Sharp focus with visible fabric texture
- Photorealistic, high-end commercial quality
- No people, no faces, no text, no brand logos
- Just the hoodie product shot

Style reference: Premium e-commerce photography like Nike, Lululemon, or Everlane product pages.`;

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "2K",
        },
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || "image/png";
        const extension = mimeType.includes("jpeg") ? "jpg" : "png";

        const filename = `${productSlug}-${colorSlug}.${extension}`;
        const filepath = path.join(OUTPUT_DIR, filename);

        // Save image
        await fs.writeFile(filepath, Buffer.from(imageData!, "base64"));

        return {
          product: productName,
          color: colorName,
          success: true,
          path: `/images/products/${filename}`,
        };
      }
    }

    return {
      product: productName,
      color: colorName,
      success: false,
      error: "No image data in response",
    };
  } catch (error) {
    return {
      product: productName,
      color: colorName,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function generateAllImages() {
  console.log("🍌 Gemini 3 Pro Image Generator (Nano Banana Pro)\n");
  console.log(`Model: ${IMAGE_MODEL}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Products: ${productData.length}`);
  console.log(`Colors: ${colors.length}`);
  console.log(`Total images: ${productData.length * colors.length}\n`);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const results: GenerationResult[] = [];
  let successCount = 0;
  let failCount = 0;

  // Generate images for each product/color combination
  for (const product of productData) {
    console.log(`\n📦 ${product.name}`);

    for (const color of colors) {
      process.stdout.write(`  • ${color.name}... `);

      const result = await generateProductImage(
        product.name,
        product.slug,
        product.style,
        color.name,
        color.hex
      );

      results.push(result);

      if (result.success) {
        successCount++;
        console.log("✓");
      } else {
        failCount++;
        console.log(`✗ (${result.error})`);
      }

      // Rate limiting - wait between requests
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Generation Summary");
  console.log("=".repeat(50));
  console.log(`Total: ${results.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    console.log("\n❌ Failed generations:");
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.product} (${r.color}): ${r.error}`);
      });
  }

  // Save results log
  const logPath = path.join(OUTPUT_DIR, "generation-log.json");
  await fs.writeFile(logPath, JSON.stringify(results, null, 2));
  console.log(`\n📝 Log saved to: ${logPath}`);
}

// Generate single test image
async function generateTestImage() {
  console.log("🧪 Generating test image with Gemini 3 Pro...\n");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const result = await generateProductImage(
    "Classic Comfort Hoodie",
    "classic-comfort-hoodie",
    "relaxed fit, soft cotton, comfortable everyday pullover hoodie",
    "Black",
    "#000000"
  );

  if (result.success) {
    console.log(`✅ Test image saved to: ${result.path}`);
  } else {
    console.log(`❌ Test failed: ${result.error}`);
  }
}

// Generate images for a single product (all colors)
async function generateProductImages(productSlug: string) {
  const product = productData.find((p) => p.slug === productSlug);
  if (!product) {
    console.log(`❌ Product not found: ${productSlug}`);
    console.log(`Available: ${productData.map((p) => p.slug).join(", ")}`);
    return;
  }

  console.log(`🎨 Generating all colors for: ${product.name}\n`);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const color of colors) {
    process.stdout.write(`  • ${color.name}... `);

    const result = await generateProductImage(
      product.name,
      product.slug,
      product.style,
      color.name,
      color.hex
    );

    if (result.success) {
      console.log(`✓ ${result.path}`);
    } else {
      console.log(`✗ ${result.error}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

// CLI
const args = process.argv.slice(2);

if (args.includes("--test")) {
  generateTestImage();
} else if (args.includes("--all")) {
  generateAllImages();
} else if (args.includes("--product") && args[args.indexOf("--product") + 1]) {
  generateProductImages(args[args.indexOf("--product") + 1]);
} else {
  console.log(`
🍌 Gemini Image Generator (Nano Banana Pro)

Usage:
  npx tsx src/scripts/generate-images.ts --test                    # Generate one test image
  npx tsx src/scripts/generate-images.ts --all                     # Generate all 48 images
  npx tsx src/scripts/generate-images.ts --product <slug>          # Generate all colors for one product

Product slugs:
  ${productData.map((p) => `- ${p.slug}`).join("\n  ")}

Make sure GOOGLE_AI_API_KEY is set in your environment.
`);
}
