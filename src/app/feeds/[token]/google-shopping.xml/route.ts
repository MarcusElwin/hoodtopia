import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { listProducts } from "@/lib/commerce/medusa-products";
import { getMarket } from "@/lib/kustom/markets";

// Google Shopping Merchant Center XML feed.
//
// Spec: https://support.google.com/merchants/answer/7052112
// We emit RSS 2.0 with the g: namespace. Each <item> is a product VARIANT
// (one row per SKU) using item_group_id to tie a colour/size set together.
//
// Pricing is VAT-inclusive in the market's currency (Google expects display
// price). Country defaults to SE; pass ?country=GB|US|DE|JP to switch.
// Image URLs must be absolute — Google fetches them from outside our host.
//
// Access control: the route lives under /feeds/[token]/google-shopping.xml.
// We compare the path token against GOOGLE_FEED_TOKEN (or "public" if no
// env var is set, for local dev). 404 on mismatch so scanners can't tell
// the route exists.
export const dynamic = "force-dynamic";

function tokensMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

const HOODIE_CATEGORIES = new Set([
  "casual",
  "performance",
  "athletic",
  "streetwear",
  "premium",
  "outdoor",
]);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function absolute(siteUrl: string, maybePath: string): string {
  if (/^https?:\/\//i.test(maybePath)) return maybePath;
  const sep = maybePath.startsWith("/") ? "" : "/";
  return `${siteUrl}${sep}${maybePath}`;
}

function formatPrice(amountCents: number, currency: string): string {
  // The adapter stores every currency as "major × 100" (Math.round(amount*100)),
  // even zero-decimal ones like JPY/SEK — so always divide by 100, and only vary
  // the printed decimals. (Matches the storefront's formatMoney.)
  const decimals = currency === "JPY" || currency === "SEK" ? 0 : 2;
  return `${(amountCents / 100).toFixed(decimals)} ${currency}`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const expected = process.env.GOOGLE_FEED_TOKEN ?? "public";
  if (!tokensMatch(token, expected)) {
    // Pretend the URL doesn't exist rather than 401 — scanners that probe
    // /feeds/* shouldn't be able to confirm the route is here.
    return new NextResponse("Not Found", { status: 404 });
  }

  const url = new URL(req.url);
  const countryParam = url.searchParams.get("country");
  const market = getMarket(countryParam);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, "");

  // Pull every catalog product + variants + per-variant extra images (Medusa),
  // priced in the requested market's currency so <g:price> is the real region
  // price (not the USD amount with a foreign label).
  const rows = await listProducts({
    currencyCode: market.purchase_currency.toLowerCase(),
  });

  // Only hoodies in the feed for now — accessories priced/sized differently.
  const hoodies = rows.filter((p) => HOODIE_CATEGORIES.has(p.category));

  const items: string[] = [];
  for (const product of hoodies) {
    const heroAbs = absolute(siteUrl, product.imageUrl);

    // Heroes of the other colour variants — appended after a variant's own
    // extras so the Google Shopping card shows the same product in the
    // remaining colours.
    const otherColorHeroes = (() => {
      const seen = new Set<string>();
      const urls: string[] = [];
      for (const v of product.variants) {
        if (!v.imageUrl) continue;
        if (seen.has(v.color)) continue;
        seen.add(v.color);
        urls.push(absolute(siteUrl, v.imageUrl));
      }
      return urls;
    })();

    for (const variant of product.variants) {
      const variantImage = variant.imageUrl
        ? absolute(siteUrl, variant.imageUrl)
        : heroAbs;
      const productUrl = `${siteUrl}/products/${product.slug}`;
      const availability = variant.stock > 0 ? "in stock" : "out of stock";

      // Per-variant extras (lifestyle / fabric close-up) first, then the
      // other-colour heroes. Dedup against the main image_link and cap at
      // Google's 10-image limit.
      const variantExtras = (product.images ?? [])
        .filter((img) => img.variantId === variant.id)
        .map((img) => absolute(siteUrl, img.url));

      const additional = [...variantExtras, ...otherColorHeroes]
        .filter((u) => u !== variantImage)
        .slice(0, 10)
        .map((u) => `      <g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`)
        .join("\n");

      items.push(
        `    <item>
      <g:id>${escapeXml(variant.sku)}</g:id>
      <g:item_group_id>${escapeXml(product.id)}</g:item_group_id>
      <title>${escapeXml(`${product.name} — ${variant.color}, ${variant.size}`)}</title>
      <link>${escapeXml(productUrl)}</link>
      <description>${escapeXml(product.description)}</description>
      <g:image_link>${escapeXml(variantImage)}</g:image_link>
${additional}
      <g:availability>${availability}</g:availability>
      <g:price>${escapeXml(formatPrice(product.basePrice, market.purchase_currency))}</g:price>
      <g:brand>Hoodtopia</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>Apparel &amp; Accessories &gt; Clothing &gt; Outerwear &gt; Coats &amp; Jackets</g:google_product_category>
      <g:product_type>${escapeXml(`Hoodies > ${product.category}`)}</g:product_type>
      <g:color>${escapeXml(variant.color)}</g:color>
      <g:size>${escapeXml(variant.size)}</g:size>
      <g:gender>unisex</g:gender>
      <g:age_group>adult</g:age_group>
      <g:shipping>
        <g:country>${escapeXml(market.purchase_country)}</g:country>
        <g:service>Standard</g:service>
        <g:price>${escapeXml(formatPrice(0, market.purchase_currency))}</g:price>
      </g:shipping>
    </item>`
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Hoodtopia</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Hoodtopia product feed (${escapeXml(market.purchase_country)} / ${escapeXml(market.purchase_currency)}) — agentic-commerce demo</description>
${items.join("\n")}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Cache at the edge for an hour; Merchant Center pulls infrequently and
      // we don't want a TRPC roundtrip on every poll.
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
