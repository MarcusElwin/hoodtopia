# MedusaJS Integration

Hoodtopia's commerce layer runs on **[MedusaJS v2](https://docs.medusajs.com/)**.
Medusa owns the catalog, variants, inventory, cart, pricing/regions, promotions,
and orders. **Kustom Checkout stays the payment step** — Medusa owns the cart,
Kustom takes payment, and the Kustom push webhook completes the Medusa cart into
a paid Medusa order.

## Topology

| Piece | Where | Port (dev) | URL (prod) |
| --- | --- | --- | --- |
| Storefront (Next.js) | repo root `src/` | 3005¹ | `hoodtopia.co` (Vercel) |
| Store/Admin API (Medusa) | `medusa/` | 9010¹ | `api.hoodtopia.co` (Fly.io) |
| Admin dashboard | served by Medusa at `/app` | 9010/app | `admin.hoodtopia.co` |
| Database | PostgreSQL | docker `:5434`¹ | Fly Postgres |

> ¹ Non-default local ports: a `pimir-minio` container squats `:9000` on the dev
> machine, so Medusa runs on **9010** and Postgres on **5434**. The storefront
> runs on **3005**. Prod uses the standard subdomains.

## Why `medusa/` is a self-contained package

Medusa is a standalone Node server, not a library. It installs in **isolation**
(its own `node_modules`, `npm install` run from inside `medusa/`) because
Medusa's CLI loads `medusa-config.ts` through a ts-node `require()` hook that
breaks when `@medusajs/medusa` and `@medusajs/framework` get hoisted to
different `node_modules` levels by an npm workspace. The root `package.json`
therefore has **no** `workspaces` key.

## The storefront ↔ Medusa seam

The storefront keeps **tRPC as its BFF** — UI/AI/persona components are
unchanged. Behind each tRPC procedure:

```
component → trpc (BFF) → @medusajs/js-sdk → Medusa Store API → adapter → legacy shape
```

- **`src/lib/medusa.ts`** — two SDK clients: `medusa` (publishable key, Store API)
  and `medusaAdmin` (secret key, server-only Admin API for one-off writes).
- **`src/lib/commerce/product-adapter.ts`** — maps Medusa products/variants to
  the legacy `Product`/`ProductVariant`/`ProductImage` shape the UI expects
  (`title`→`name`, `handle`→`slug`, `calculated_price` ×100 → cents,
  `metadata.features` → JSON string, option `Color`/`Size` → `color`/`size`, …).
- **`src/lib/commerce/medusa-products.ts`** — `listProducts` / `getProductById`
  / `getProductByHandle` / `resolveRegionId` / `resolveCategoryId` /
  `getStockBySku`.
- **`src/lib/commerce/medusa-cart.ts`** — cart wrappers + `adaptCart`,
  `applyPromo`/`removePromo`, `completeCart`, `findMedusaOrderByKustomId`.
- **`src/lib/commerce/cart-session.ts`** — maps the demo session to its Medusa
  cart id (in the `medusa_carts` SQLite table); starts a fresh cart if the
  stored one was already completed.

## Order flow (Kustom → Medusa)

```
cart (Medusa)
  └─ initCheckout: build Kustom order from the Medusa cart (cart-mapper)
       └─ Kustom iframe → customer pays (Klarna playground)
            ├─ confirmation page → checkout.syncOrder (INSTANT, idempotent)
            └─ Kustom push webhook (~2 min, async) → /api/kustom/push
                 └─ syncKustomOrder(kustomOrderId)
                      ├─ already synced?  → return existing Medusa order (idempotent)
                      └─ else → complete the Medusa cart into a Medusa order,
                               faithful to the Kustom order's address + email +
                               chosen shipping carrier; stamp kustom_order_id in
                               the order metadata; reset the session cart.
```

`src/lib/commerce/order-sync.ts` is the shared, idempotent path used by both the
push webhook and the instant confirmation-page sync.

**Stock validation:** Kustom's `validation`/`upsell` callbacks re-check inventory
against **Medusa** (`getStockBySku`), and only validate `physical`/`digital`
lines — discount/shipping/tax lines are skipped (a promo line's `reference` is
the promo code, not a SKU).

## Promotions

Medusa promotions, applied in the cart (`cart.applyPromo`), flow to Kustom as a
negative `discount` order_line so the payment total matches. Percentage promos
are **currency-agnostic** (no `currency_code` on the application method) so they
work in every market. Seeded codes: `WELCOME10` (10% off), `HOODIE20` (20% off),
`FREESHIP` (100% off shipping).

## Custom AI designs

A generated Gemini design added to cart becomes a real, one-off Medusa product
(`category: custom`, one variant, no inventory tracking, $100 across all 5
currencies) created via the Admin API, then added to the Medusa cart. The Gemini
design record itself stays in the storefront DB (`customDesigns`) — it's design
metadata, not commerce data.

## Markets / currencies

5 regions, one per market: US/USD, SE/SEK, GB/GBP, DE/EUR, JP/JPY. Variant
prices are set per currency (price sets). The storefront's currency switcher
maps to a Medusa region; checkout passes the country to Kustom for the right
`purchase_country`/`purchase_currency`/VAT.

## What stays on Drizzle/SQLite

Only non-commerce tables: `customDesigns` (Gemini design metadata),
`chatMessages`, `userPreferences`, `chatSafetyEvents`, and `medusa_carts` (the
session → Medusa-cart-id pointer).

## Local setup

```bash
# 1. Postgres
docker compose up -d medusa-db          # host port 5434

# 2. Medusa backend (run from medusa/ — isolated install)
cd medusa
cp .env.template .env                   # DATABASE_URL etc.
npm install
npx medusa db:migrate
npx medusa user -e admin@hoodtopia.co -p supersecret
npm run seed                            # products, regions, etc.
npm run seed:extras                     # promotions, collections, types, tags,
                                        # native material, KSA shipping, price
                                        # list, AI Agents channel, admin key
PORT=9010 npm run dev                   # API + admin on :9010/app

# 3. Storefront (separate shell). Set the storefront env first:
#    NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9010
#    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...   (printed by `npm run seed`)
#    MEDUSA_ADMIN_API_KEY=sk_...                 (printed by `npm run seed:extras`)
npm run dev:tunnel                      # ngrok → :3005 so Kustom callbacks reach you
```

See [`medusa/README.md`](../medusa/README.md) for backend specifics and
[`KUSTOM_INTEGRATION.md`](./KUSTOM_INTEGRATION.md) for the Kustom side.
