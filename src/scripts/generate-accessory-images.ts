import * as dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// Get API key from environment (supports multiple env var names)
const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("❌ No API key found. Set one of: GOOGLE_AI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY");
  process.exit(1);
}

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey });

// Using Gemini 3 Pro Image Preview for highest quality
const IMAGE_MODEL = "gemini-3-pro-image-preview";

// Output directory
const OUTPUT_DIR = path.join(process.cwd(), "public/images/accessories");

// Accessory definitions with prompts
const accessories = [
  {
    slug: "logo-sticker-pack",
    name: "Hoodtopia Logo Sticker Pack",
    prompt: `Professional e-commerce product photograph of a premium vinyl sticker pack laid out on a clean white surface.

5 different hoodie-themed stickers with modern minimalist designs in purple, black and white colors. Includes a hoodie silhouette, the letter 'H' logo, a cozy hoodie with steam/warmth lines, 'Stay Cozy' text sticker, and a small hoodie character.

Photography requirements:
- Clean white to light gray gradient studio background
- Professional soft-box lighting, even and flattering
- Top-down flat lay view
- Sharp focus with visible sticker details
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Premium e-commerce photography like Society6 or Redbubble product pages.`,
  },
  {
    slug: "holographic-stickers",
    name: "Holographic Hoodie Stickers",
    prompt: `Professional e-commerce product photograph of 3 holographic iridescent stickers arranged on a dark surface showing rainbow shimmer effect.

Hoodie-themed designs with prismatic/holographic finish catching light beautifully. One sticker shows a hoodie outline, one says 'Hood Life', one is a sparkly hoodie icon.

Photography requirements:
- Dark surface to show holographic effect
- Angled lighting to capture rainbow shimmer
- Visible iridescent/prismatic colors
- Sharp focus with visible holographic texture
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Premium holographic sticker product photography.`,
  },
  {
    slug: "enamel-pin-set",
    name: "Enamel Pin Set",
    prompt: `Professional e-commerce product photograph of 3 collectible hard enamel pins with gold metal plating on a dark velvet display surface.

Hoodie-themed designs: one purple hoodie shape pin, one 'H' letter pin with enamel fill, one tiny hoodie with heart pin. Butterfly clutch backs visible.

Photography requirements:
- Dark velvet or premium display surface
- Professional lighting showing glossy enamel finish
- Slight angle to show dimension and gold plating
- Sharp focus with visible metal and enamel details
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Premium enamel pin photography like those on Etsy or Pin Culture.`,
  },
  {
    slug: "hoodie-love-pin",
    name: "Hoodie Love Pin",
    prompt: `Professional e-commerce product photograph of a single adorable enamel pin on a minimalist light surface.

The pin design is a cute hoodie shaped like a heart, with soft enamel in purple and pink colors, silver metal outline. Kawaii/cute aesthetic.

Photography requirements:
- Clean white or light gray background
- Professional soft lighting
- Close-up view showing pin detail and craftsmanship
- Sharp focus on enamel and metal finish
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Cute kawaii pin product photography.`,
  },
  {
    slug: "iron-on-patches",
    name: "Iron-On Patch Collection",
    prompt: `Professional e-commerce product photograph of 4 embroidered iron-on patches arranged on a light wooden or fabric surface.

Hoodie brand themed: one circular 'Hoodtopia' text patch, one hoodie silhouette patch, one 'Stay Cozy' banner patch, one small 'H' logo patch. Rich embroidery texture visible, variety of sizes.

Photography requirements:
- Light wood or natural fabric background
- Warm natural lighting
- Flat lay arrangement showing all patches
- Sharp focus with visible embroidery texture
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Artisan embroidered patch product photography.`,
  },
  {
    slug: "chenille-letter-patch",
    name: "Chenille Letter Patch",
    prompt: `Professional e-commerce product photograph of a varsity-style chenille letter patch, the letter 'H' in purple chenille/fuzzy texture on a cream/white felt backing.

Classic collegiate letterman jacket style patch with soft fuzzy texture.

Photography requirements:
- Clean white or light gray background
- Professional lighting showing fuzzy chenille texture
- Slight angle to show dimension and texture
- Sharp focus on the soft chenille material
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Varsity letterman patch product photography.`,
  },
  {
    slug: "mini-hoodie-keychain",
    name: "Mini Hoodie Keychain",
    prompt: `Professional e-commerce product photograph of an adorable miniature plush hoodie keychain on a clean white surface.

A tiny 3-inch soft plush hoodie in purple color with a shiny silver/chrome lobster clasp attached. The mini hoodie has cute details like a tiny hood, kangaroo pocket, and ribbed cuffs. Looks squeezable and cuddly.

Photography requirements:
- Clean white to light gray gradient background
- Professional soft lighting showing plush texture
- Three-quarter angle to show the hoodie shape and clasp
- Sharp focus with visible soft fabric texture
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Cute plush keychain product photography like Sanrio or Pusheen merchandise.`,
  },
  {
    slug: "cozy-club-socks",
    name: "Cozy Club Socks",
    prompt: `Professional e-commerce product photograph of a pair of cozy crew socks laid flat on a light surface.

Purple and cream colored socks with cute hoodie pattern - tiny hoodie silhouettes and 'Stay Cozy' text knitted into the design. Ribbed cuff visible, cushioned look. Premium quality appearance.

Photography requirements:
- Clean white or light marble background
- Professional soft lighting
- Flat lay view showing both socks
- Sharp focus with visible knit texture and pattern
- Photorealistic, high-end commercial quality
- No people, no feet, just the socks

Style reference: Premium sock brand photography like Bombas or Happy Socks.`,
  },
  {
    slug: "rainbow-drawstring-set",
    name: "Rainbow Drawstring Set",
    prompt: `Professional e-commerce product photograph of 4 colorful braided drawstring cords arranged in a artistic layout on a dark surface.

Four hoodie replacement drawstrings in different colors: purple, teal, coral pink, and mustard yellow. Each cord has shiny metal aglet tips. Braided cotton texture visible.

Photography requirements:
- Dark slate or charcoal background
- Professional lighting showing cord texture and metal aglets
- Artistic curved arrangement
- Sharp focus with visible braided texture
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Premium accessories flat lay photography.`,
  },
  {
    slug: "canvas-tote-bag",
    name: "Hoodtopia Canvas Tote",
    prompt: `Professional e-commerce product photograph of a natural canvas tote bag standing upright on a clean surface.

Cream/natural colored canvas tote with a cute illustrated hoodie design printed on the front in purple ink. Sturdy handles, slightly slouchy shape showing it's soft canvas. The print shows a cozy hoodie with sparkles around it and 'Hoodtopia' text below.

Photography requirements:
- Clean white or light gray gradient background
- Professional soft lighting
- Three-quarter view showing bag shape and print
- Sharp focus with visible canvas texture
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Eco-friendly tote bag product photography.`,
  },
  {
    slug: "hoodie-care-kit",
    name: "Hoodie Care Kit",
    prompt: `Professional e-commerce product photograph of a hoodie care kit contents arranged in a flat lay on a light surface.

Contents include: a small spray bottle with purple liquid and 'Fabric Fresh' label, a mini lint roller with purple handle, a folded gray microfiber cloth, and a small care instruction card. All items arranged in/around a small zippered pouch.

Photography requirements:
- Clean white or light marble background
- Professional soft lighting
- Top-down flat lay arrangement
- Sharp focus on all items
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Skincare or grooming kit flat lay photography.`,
  },
  {
    slug: "glow-pin",
    name: "Glow-in-Dark Pin",
    prompt: `Professional e-commerce product photograph showing a split image: on the left side, an enamel pin in normal lighting; on the right side, the same pin glowing bright green in darkness.

The pin is shaped like a cute hoodie silhouette. In normal light it appears white/cream colored with silver metal outline. The glowing side shows it emitting bright green phosphorescent glow.

Photography requirements:
- Split composition showing lit and dark versions
- Professional lighting on lit side, dark background on glow side
- Sharp focus showing enamel detail and glow effect
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Glow-in-the-dark product reveal photography.`,
  },
  {
    slug: "hoodie-mug",
    name: "Hoodie Shaped Mug",
    prompt: `Professional e-commerce product photograph of a creative ceramic mug designed to look like a hoodie.

Purple ceramic mug where the handle is shaped like a hoodie sleeve, the body has a raised kangaroo pocket detail on the front, and the rim has a subtle hood shape. Glossy glaze finish. Adorable and unique design.

Photography requirements:
- Clean white or light gray gradient background
- Professional soft lighting showing ceramic glaze
- Three-quarter angle showing handle and pocket detail
- Sharp focus with visible ceramic texture
- Photorealistic, high-end commercial quality
- No people, no faces

Style reference: Novelty mug product photography like those on Uncommon Goods.`,
  },
];

interface GenerationResult {
  name: string;
  slug: string;
  success: boolean;
  path?: string;
  error?: string;
}

async function generateAccessoryImage(
  name: string,
  slug: string,
  prompt: string
): Promise<GenerationResult> {
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

        const filename = `${slug}.${extension}`;
        const filepath = path.join(OUTPUT_DIR, filename);

        // Save image
        await fs.writeFile(filepath, Buffer.from(imageData!, "base64"));

        return {
          name,
          slug,
          success: true,
          path: `/images/accessories/${filename}`,
        };
      }
    }

    return {
      name,
      slug,
      success: false,
      error: "No image data in response",
    };
  } catch (error) {
    return {
      name,
      slug,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function generateAllAccessories() {
  console.log("🎁 Gemini Accessory Image Generator\n");
  console.log(`Model: ${IMAGE_MODEL}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Accessories: ${accessories.length}\n`);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const results: GenerationResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const accessory of accessories) {
    process.stdout.write(`  • ${accessory.name}... `);

    const result = await generateAccessoryImage(
      accessory.name,
      accessory.slug,
      accessory.prompt
    );

    results.push(result);

    if (result.success) {
      successCount++;
      console.log(`✓ ${result.path}`);
    } else {
      failCount++;
      console.log(`✗ (${result.error})`);
    }

    // Rate limiting - wait between requests
    await new Promise((resolve) => setTimeout(resolve, 2000));
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
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }

  // Save results log
  const logPath = path.join(OUTPUT_DIR, "generation-log.json");
  await fs.writeFile(logPath, JSON.stringify(results, null, 2));
  console.log(`\n📝 Log saved to: ${logPath}`);
}

// Generate single test image
async function generateTestImage() {
  console.log("🧪 Generating test accessory image with Gemini 3 Pro...\n");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const accessory = accessories[0];
  process.stdout.write(`  • ${accessory.name}... `);

  const result = await generateAccessoryImage(
    accessory.name,
    accessory.slug,
    accessory.prompt
  );

  if (result.success) {
    console.log(`✓`);
    console.log(`\n✅ Test image saved to: ${result.path}`);
  } else {
    console.log(`✗`);
    console.log(`\n❌ Test failed: ${result.error}`);
  }
}

// Generate single accessory by slug
async function generateSingleAccessory(slug: string) {
  const accessory = accessories.find((a) => a.slug === slug);
  if (!accessory) {
    console.log(`❌ Accessory not found: ${slug}`);
    console.log(`\nAvailable accessories:`);
    accessories.forEach((a) => console.log(`  - ${a.slug}`));
    return;
  }

  console.log(`🎨 Generating: ${accessory.name}\n`);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  process.stdout.write(`  • ${accessory.name}... `);

  const result = await generateAccessoryImage(
    accessory.name,
    accessory.slug,
    accessory.prompt
  );

  if (result.success) {
    console.log(`✓ ${result.path}`);
  } else {
    console.log(`✗ ${result.error}`);
  }
}

// CLI
const args = process.argv.slice(2);

if (args.includes("--test")) {
  generateTestImage();
} else if (args.includes("--all") || args.length === 0) {
  generateAllAccessories();
} else if (args[0] && !args[0].startsWith("--")) {
  generateSingleAccessory(args[0]);
} else {
  console.log(`
🎁 Gemini Accessory Image Generator

Usage:
  npx tsx src/scripts/generate-accessory-images.ts --test           # Generate one test image
  npx tsx src/scripts/generate-accessory-images.ts --all            # Generate all 6 accessory images
  npx tsx src/scripts/generate-accessory-images.ts <slug>           # Generate specific accessory

Accessory slugs:
  ${accessories.map((a) => `- ${a.slug}`).join("\n  ")}

Make sure GOOGLE_AI_API_KEY is set in your environment.
`);
}
