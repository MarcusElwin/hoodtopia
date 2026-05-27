import * as dotenv from "dotenv";
import * as fs from "fs/promises";
import * as path from "path";
import sharp from "sharp";

dotenv.config({ path: ".env.local" });

import { db, productImages } from "../db";
import { eq } from "drizzle-orm";

// One-shot: PNG -> JPEG (q85, mozjpeg) for the 96 variant-extra images,
// then update product_images.url to point at the new .jpg path and delete
// the source PNGs. Idempotent — re-runs skip files that are already JPEG.

const DIR = path.join(process.cwd(), "public/images/products/extra");
const QUALITY = 85;

async function convertOne(pngPath: string): Promise<{ from: string; to: string } | null> {
  const base = path.basename(pngPath, ".png");
  const jpgPath = path.join(DIR, `${base}.jpg`);
  await sharp(pngPath)
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(jpgPath);
  await fs.unlink(pngPath);
  return { from: `${base}.png`, to: `${base}.jpg` };
}

async function run() {
  const files = await fs.readdir(DIR);
  const pngs = files.filter((f) => f.endsWith(".png"));

  console.log(`Converting ${pngs.length} PNG -> JPEG (q${QUALITY}, mozjpeg)`);

  let beforeBytes = 0;
  let afterBytes = 0;

  for (const file of pngs) {
    const src = path.join(DIR, file);
    const srcStat = await fs.stat(src);
    beforeBytes += srcStat.size;
    process.stdout.write(`  ${file} ... `);
    const result = await convertOne(src);
    if (!result) {
      console.log("skip");
      continue;
    }
    const dstStat = await fs.stat(path.join(DIR, result.to));
    afterBytes += dstStat.size;
    console.log(
      `${(srcStat.size / 1024 / 1024).toFixed(2)} MB -> ${(dstStat.size / 1024 / 1024).toFixed(2)} MB`
    );
  }

  console.log(`\nTotal: ${(beforeBytes / 1024 / 1024).toFixed(0)} MB -> ${(afterBytes / 1024 / 1024).toFixed(0)} MB`);

  // Now repoint product_images.url from .png to .jpg.
  console.log(`\nUpdating product_images.url rows ...`);
  const rows = await db.select().from(productImages);
  let updated = 0;
  for (const row of rows) {
    if (!row.url.endsWith(".png")) continue;
    const newUrl = row.url.replace(/\.png$/, ".jpg");
    await db.update(productImages).set({ url: newUrl }).where(eq(productImages.id, row.id));
    updated++;
  }
  console.log(`Updated ${updated} rows.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
