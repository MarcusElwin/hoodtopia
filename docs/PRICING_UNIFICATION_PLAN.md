# Plan: unify pricing — Medusa region price on every surface (Option 2)

## Goal

Make the price shown on the **PDP = product cards = cart = checkout = Kustom =
Medusa order**, with **one source of truth (Medusa region prices)** and **no
client-side FX** for display. Eliminates the "two pricing engines" class of bug
permanently (drift becomes structurally impossible, not "kept equal").

## Why this, not the alternatives

| | Root cause removed? | Latent re-break risk | Churn |
|---|---|---|---|
| Opt 1 — keep USD-cents UI, align FX tables | No | Two FX tables must stay equal forever | Low |
| Opt 3 — stop the bleed (no-FX cart line only) | No | PDP≠cart drift persists | Tiny |
| **Opt 2 — Medusa price everywhere (this)** | **Yes** | **None** | Medium (~11 sites) |

## The bug we're fixing (proven trace — $9.99 sticker in SEK, post-#37 build)

`formatPrice()` ALWAYS does client FX (treats input as USD cents × `currency.rate`).

| Surface | Code today | Renders | Notes |
|---|---|---|---|
| PDP | `formatPrice(999)` | 108.39 kr | client-FX of USD (query has no currency) |
| **Cart line** | `formatPrice(10800)` | **1,171.80 kr** | ❌ DOUBLE-FX (priceAtAdd is the SEK region price post-#37) |
| Express btn | `unitPriceMinor: 10800` | 108.00 kr | ✓ region price |
| Kustom | `unit_price: 10800` | 108.00 kr | ✓ region price |
| Medusa order | region price | 108.00 kr | ✓ region price |

Two root problems:
1. **Product queries don't pass currency** → `basePrice` is the USD region price, then `formatPrice` FXes it.
2. **`priceAtAdd` is overloaded** — used for display (wants USD cents for `formatPrice`) AND for charge (Kustom/express want region minor units). #37 made it the region price, which fixed charge/order but broke the cart-line display.

## Target architecture

- Product queries are **region-scoped**: pass the selected currency so Medusa
  returns `calculated_price` in that currency. `basePrice` / variant prices
  become **already-in-currency minor units**.
- New **`formatMoney(minorUnits)`** in `currency.tsx`: formats an
  already-in-display-currency amount (symbol, separators, JPY/SEK 0-decimals) —
  **no FX**. This replaces `formatPrice` at every Medusa-sourced render.
- `formatPrice` / `convertPrice` (client FX) are **retired from display**. Keep
  `convertPrice` only if some non-Medusa amount still needs converting (audit
  says: none after this change — custom design $100 can be sourced from Medusa
  or formatted via a fixed per-currency table).
- Cart adapter stops overloading: `priceAtAdd` = region minor units (charge),
  and the cart line renders it with `formatMoney` (no FX). Express/Kustom keep
  using the same region minor units. **One number, formatted not converted.**

Result for the sticker in SEK: **108 kr on every surface** (PDP, card, cart,
express, Kustom, order). Zero drift, no FX tables in the display path.

## Work items

### 1. `src/lib/currency.tsx`
- Add `formatMoney(minorUnits: number): string` — format only (uses
  `currency.symbol`, `currency.decimals`, separators; JPY/SEK → 0 decimals). No
  `convertPrice`.
- Expose it from the context value + `useCurrency()`.
- Keep `currency.code` (already used) for threading into queries.
- Leave `formatPrice`/`convertPrice` in place for one transition step, but no
  display site should call them after step 4. (Optionally delete in a follow-up
  once nothing references them.)

### 2. Product router / commerce lib — make region pricing reach the UI
- `products.bySlug/byId/list/featured/featuredAccessories/search` already accept
  an optional `currency`. Confirm each forwards it to
  `listProducts/getProductById/getProductByHandle({ currencyCode })`. (Phase-3
  scaffolding left this wired but unused.)
- `cart.getRecommendations` / `checkout.getPostPurchaseRecommendations`: pass the
  cart/region currency so recommended products carry region prices too.

### 3. Query callers — pass the selected currency (so basePrice is region-priced)
Thread `currency.code` (or `country.currency`) into each `useQuery`:
- `src/app/products/[slug]/page.tsx:25` → `bySlug({ slug, currency: currency.code })`
- `src/components/products/product-grid.tsx:15` → `list({ …, currency })`
- `src/components/home/best-sellers.tsx:11` → `list({ currency })`
- `src/components/home/featured-products.tsx:11` → `featured({ currency })`
- `src/components/home/featured-accessories.tsx:11` → `featuredAccessories({ currency })`
- `src/components/products/ai-recommendations.tsx:47` → `list({ currency })`
- `cart-recommendations` / `post-purchase-recommendations` → via their routers (step 2)

> Note: queries become currency-keyed, so switching currency refetches. That's
> correct (prices change). React Query caches per input, so it's cheap.

### 4. Swap display renders `formatPrice` → `formatMoney` (Medusa-sourced amounts)
- `src/app/products/[slug]/page.tsx:287` (basePrice)
- `src/app/cart/page.tsx:153` (priceAtAdd), `:240` (subtotal), `:250` (discount), `:340` (total)
- `src/components/products/product-card.tsx:87`
- `src/components/products/adaptive-product-card.tsx:115`
- `src/components/products/product-comparison.tsx:46` (min/max)
- `src/components/products/ai-recommendations.tsx:508`
- `src/components/checkout/post-purchase-recommendations.tsx:96`
- `src/components/ai/chat-product-card.tsx:84`
- `src/components/cart/cart-recommendations.tsx:142`
- `src/app/custom-designer/page.tsx:36` (custom design price — source from Medusa region or a fixed per-currency constant)

### 5. Cart adapter — stop overloading `priceAtAdd`
- `priceAtAdd` stays = region minor units (charge). Cart line now renders it with
  `formatMoney` (step 4), so no double-FX. Express/Kustom already use it as
  charge — unchanged. (No dual-field needed once display uses `formatMoney`.)

### 6. Feed (`google-shopping.xml/route.ts`) — already per-market
- It has its own server `formatPrice(amountCents, currency)` and builds prices
  per market. Confirm `product.basePrice` there is the per-market region price
  (pass currency when listing for the feed). Likely a one-line `currencyCode`
  add; otherwise leave (separate, server-only surface).

### 7. Drop / quarantine client FX
- After step 4, grep shows zero display callers of `formatPrice`/`convertPrice`.
  Either delete them or mark deprecated. The seed `FX` and storefront
  `currency.rate` tables are then **display-irrelevant** (FX lives only in
  Medusa region prices). Keep `currency.rate` only if the feed/custom-design
  still needs it; otherwise remove to prevent future confusion.

## Test matrix (every price surface, in 2+ currencies: USD + SEK, spot-check JPY)

| Surface | Expect (SEK, $9.99 sticker / $79.99 hoodie) |
|---|---|
| PDP price | 108 kr / 864 kr (Medusa region) |
| Product card / grid | same as PDP |
| Best sellers / featured / accessories | region price |
| AI recommendation cards | region price |
| Product comparison min–max | region prices |
| Cart line + subtotal/discount/total | **108 kr** (not 1,171, not 9.99) |
| Express button charge | 108 kr |
| Kustom checkout iframe | 108 kr |
| Confirmation page | 108 kr |
| Medusa admin order | 108 kr |
| Custom designer price | $100 → region equivalent |

All ten product+cart surfaces must equal the cart, Kustom, and order for the
same item. Switching the currency switcher must refetch and re-price every
surface consistently.

## Rollout

1. New branch `fix/pricing-unification` off `main`.
2. Implement steps 1→5, typecheck + `npm run ci`.
3. Manual test matrix on a Vercel **preview** (note: Kustom push webhook targets
   prod, so verify the order via the instant confirmation-page sync on preview,
   full webhook on prod after merge).
4. PR with before/after price table. Merge → prod deploy. Re-run a SEK buy-flow
   and confirm `[kustom/push] sync … -> created` + admin order at 108 kr.

## Open questions for you

- **Custom design $100**: source from a Medusa product (cleanest, one source) or
  keep a fixed per-currency constant? (Today it's `CUSTOM_DESIGN_PRICE_CENTS`
  client-FX'd.)
- **Google feed**: in scope now, or leave it (server-only, already per-market)?
- **Delete `formatPrice`/`convertPrice`** in this PR, or deprecate and remove in
  a follow-up to keep the diff focused?
