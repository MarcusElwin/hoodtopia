import * as dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

// Loaded before any code that reads env (db/index.ts reads TURSO_*).
dotenv.config({ path: ".env.local" });

import { db, productImages, productVariants } from "../db";
import { eq, and } from "drizzle-orm";

// Generates 2 extra angle/lifestyle images PER VARIANT (one row per colour),
// in addition to the colour-specific hero already on productVariants.imageUrl.
// 6 products × 8 colours × 2 shots = 96 images for a full run.
//
// Writes to public/images/products/extra/<slug>-<color-slug>-<position>.png
// and upserts product_images rows. Idempotent per (variantId, position).

const apiKey =
  process.env.GOOGLE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error(
    "Missing API key — set GEMINI_API_KEY (or GOOGLE_AI_API_KEY) in .env.local"
  );
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
// Default to Pro for consistency with the initial 96-image batch. For
// future regenerations, gemini-3.1-flash-image-preview ("Nano Banana 2")
// is the recommended default — same quality bracket, much cheaper. Switch
// once we standardise on Flash for the catalog.
const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-3-pro-image-preview";

const OUTPUT_DIR = path.join(process.cwd(), "public/images/products/extra");
const PUBLIC_PATH_PREFIX = "/images/products/extra";

interface ExtraShot {
  position: number;
  alt: string;
  promptSuffix: string;
}

const EXTRA_SHOTS: ExtraShot[] = [
  {
    position: 1,
    alt: "lifestyle shot",
    promptSuffix: `Lifestyle product photograph — hoodie casually styled, hanging or
draped on a minimalist wooden hanger or chair in a warm, sunlit
interior. Soft natural light, shallow depth of field, magazine-
editorial feel. Sharp focus on fabric weave.
No people, no faces, no logos.`,
  },
  {
    position: 2,
    alt: "fabric close-up",
    promptSuffix: `Extreme close-up product photograph — macro shot of the hoodie's
fabric texture, stitching, and hood drawstrings in the specified
colour. Studio softbox lighting, neutral gray background, sharp
focus showing weave detail. No people, no faces, no logos.`,
  },
];

const STYLE_BY_SLUG: Record<string, string> = {
  "classic-comfort-hoodie": "relaxed-fit soft cotton everyday pullover hoodie",
  "tech-fleece-pro": "athletic-fit technical fleece performance hoodie with sleek modern lines",
  "athletic-performance-hoodie": "lightweight athletic hoodie with breathable mesh panels",
  "oversized-street-hoodie": "oversized urban streetwear pullover with dropped shoulders",
  "premium-zip-up": "minimalist premium full-zip hoodie with clean luxury lines",
  "heavyweight-winter-hoodie": "thick heavyweight insulated rugged outdoor winter hoodie",
};

interface RunResult {
  slug: string;
  color: string;
  position: number;
  status: "ok" | "skip" | "error";
  detail?: string;
}

async function generateOne(
  baseStyle: string,
  colorName: string,
  colorHex: string,
  shot: ExtraShot
): Promise<Buffer> {
  const prompt = `Professional e-commerce product photograph of a ${baseStyle}
in the colour ${colorName} (${colorHex}).

${shot.promptSuffix}

Photography requirements:
- Photorealistic, premium commercial quality
- High resolution, sharp focus
- Colour must clearly match ${colorName} (${colorHex})
- No people, no faces, no text, no brand logos, no watermarks

Style reference: Premium e-commerce photography like Aritzia, COS, or
Everlane editorial product imagery.`;

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: "1:1", imageSize: "2K" },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }
  throw new Error("Gemini returned no image data");
}

async function upsertImage(
  productId: string,
  productSlug: string,
  variantId: string,
  colorName: string,
  colorHex: string,
  shot: ExtraShot
): Promise<RunResult> {
  const baseStyle = STYLE_BY_SLUG[productSlug];
  if (!baseStyle) {
    return {
      slug: productSlug,
      color: colorName,
      position: shot.position,
      status: "skip",
      detail: `no style mapping for slug ${productSlug}`,
    };
  }

  try {
    const buffer = await generateOne(baseStyle, colorName, colorHex, shot);
    const colorSlug = colorName.toLowerCase().replace(/ /g, "-");
    const filename = `${productSlug}-${colorSlug}-${shot.position}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    await fs.writeFile(filepath, buffer);
    const url = `${PUBLIC_PATH_PREFIX}/${filename}`;

    // Upsert: delete any row at (variantId, position), then insert.
    const dupes = await db
      .select()
      .from(productImages)
      .where(
        and(
          eq(productImages.variantId, variantId),
          eq(productImages.position, shot.position)
        )
      );
    for (const d of dupes) {
      await db.delete(productImages).where(eq(productImages.id, d.id));
    }
    await db.insert(productImages).values({
      id: uuidv4(),
      productId,
      variantId,
      url,
      position: shot.position,
      alt: shot.alt,
    });

    return { slug: productSlug, color: colorName, position: shot.position, status: "ok" };
  } catch (err) {
    return {
      slug: productSlug,
      color: colorName,
      position: shot.position,
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function run(opts: {
  slugFilter?: string;
  colorFilter?: string;
  testOnly?: boolean;
  shotsOnly?: number[];
}) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const allProducts = await db.query.products.findMany({
    with: { variants: true },
  });
  const hoodieSlugs = Object.keys(STYLE_BY_SLUG);
  let targets = allProducts.filter((p) => hoodieSlugs.includes(p.slug));

  if (opts.slugFilter) {
    targets = targets.filter((p) => p.slug === opts.slugFilter);
  }

  // Flatten to (product, variant) pairs, dedup variants by colour since
  // image is colour-driven (no need for separate runs per size).
  const work: Array<{
    productId: string;
    productSlug: string;
    variantId: string;
    color: string;
    colorHex: string;
  }> = [];
  for (const p of targets) {
    const seen = new Set<string>();
    for (const v of p.variants) {
      if (seen.has(v.color)) continue;
      seen.add(v.color);
      if (opts.colorFilter && v.color.toLowerCase() !== opts.colorFilter.toLowerCase()) {
        continue;
      }
      work.push({
        productId: p.id,
        productSlug: p.slug,
        variantId: v.id,
        color: v.color,
        colorHex: v.colorHex,
      });
    }
  }

  if (opts.testOnly) {
    work.splice(1); // keep just the first variant
  }

  const shots = opts.shotsOnly
    ? EXTRA_SHOTS.filter((s) => opts.shotsOnly!.includes(s.position))
    : EXTRA_SHOTS;

  if (work.length === 0) {
    console.error("No matching variants found.");
    process.exit(1);
  }

  const total = work.length * shots.length;
  console.log(`Gemini extra-image generator (per-variant)`);
  console.log(`  Model:    ${IMAGE_MODEL}`);
  console.log(`  Output:   ${OUTPUT_DIR}`);
  console.log(`  Variants: ${work.length}`);
  console.log(`  Shots:    ${shots.length} per variant`);
  console.log(`  Total:    ${total} images`);
  console.log(`  Estimate: ~${Math.ceil((total * 2) / 60)} min @ 1.5s/req\n`);

  const results: RunResult[] = [];
  for (const w of work) {
    console.log(`* ${w.productSlug} / ${w.color}`);
    for (const shot of shots) {
      process.stdout.write(`    pos ${shot.position} (${shot.alt})... `);
      const r = await upsertImage(
        w.productId,
        w.productSlug,
        w.variantId,
        w.color,
        w.colorHex,
        shot
      );
      results.push(r);
      console.log(
        r.status === "ok"
          ? "ok"
          : r.status === "skip"
            ? `skip (${r.detail})`
            : `error (${r.detail})`
      );
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const skip = results.filter((r) => r.status === "skip").length;
  const err = results.filter((r) => r.status === "error").length;
  console.log(`\nDone — ok=${ok} skip=${skip} error=${err}`);
  if (err > 0) process.exitCode = 1;
}

const args = process.argv.slice(2);
const slugIdx = args.indexOf("--product");
const slug = slugIdx >= 0 ? args[slugIdx + 1] : undefined;
const colorIdx = args.indexOf("--color");
const color = colorIdx >= 0 ? args[colorIdx + 1] : undefined;
const shotIdx = args.indexOf("--shot");
const shotStr = shotIdx >= 0 ? args[shotIdx + 1] : undefined;
const shots = shotStr ? shotStr.split(",").map(Number) : undefined;
const testOnly = args.includes("--test");
const showHelp = args.includes("--help") || args.includes("-h");

// silence unused linter when productVariants isn't referenced after refactor
void productVariants;

if (showHelp) {
  console.log(`
Generate extra product images PER VARIANT (lifestyle + fabric close-up) via Gemini.

Usage:
  npx tsx src/scripts/generate-product-images.ts --all
  npx tsx src/scripts/generate-product-images.ts --test
  npx tsx src/scripts/generate-product-images.ts --product <slug>
  npx tsx src/scripts/generate-product-images.ts --product <slug> --color <name>
  npx tsx src/scripts/generate-product-images.ts --shot 1            # only lifestyle
  npx tsx src/scripts/generate-product-images.ts --shot 1,2          # both

Writes: public/images/products/extra/<slug>-<color>-<position>.png
Rows:   product_images keyed on (variantId, position)
`);
  process.exit(0);
}

run({ slugFilter: slug, colorFilter: color, testOnly, shotsOnly: shots }).catch((err) => {
  console.error(err);
  process.exit(1);
});
