# Refactor Hoodtopia's ecommerce layer to MedusaJS (keep Kustom checkout)

## Context

**Hoodtopia** is a Next.js 16 demo app (tRPC + Drizzle + SQLite/Turso) built for the LangChain Stockholm meetup. Today its ecommerce data — products, variants, images, cart, inventory, orders — lives in a hand-rolled Drizzle schema (`src/db/schema.ts`) and is served through tRPC routers (`src/server/routers/*`). Checkout/payment is handled by **Kustom Checkout** (iframe + shipping assistant + push webhook), which builds its order payload from Drizzle rows in `src/lib/kustom/cart-mapper.ts`.

**Goal:** Replace the homegrown commerce layer with **MedusaJS v2** as the real backend (PostgreSQL, Store/Admin API, admin dashboard) — moving *everything ecommerce* to Medusa **except Kustom**, which stays exactly as the checkout/payment step. The user wants to **learn the framework**, so the work ships as **many tiny, individually-explained commits** in one PR.

**Why:** Medusa is an industry-standard headless commerce engine. Moving catalog/cart/orders onto it (a) makes the demo realistic, (b) gives a proper admin UI + inventory + regions/pricing, and (c) teaches Medusa's module/API/SDK model. Kustom is deliberately preserved as the payment provider — Medusa owns the cart, Kustom takes payment, and the Kustom push webhook then **completes the Medusa cart into a paid Medusa order** (Medusa becomes the order source of truth; the local `orders` table is dropped).

### Key architectural fact
Medusa v2 is a **standalone Node server** (port 9000, PostgreSQL, admin dashboard served by the backend at `/app`), **not** a library you import into Next.js. So "refactor to Medusa" = stand up a Medusa backend + rewire the Next.js app into a **storefront** that talks to Medusa's Store API via `@medusajs/js-sdk`. The **admin panel cannot be hosted on Vercel** — it's part of the long-running Medusa server.

### Production topology (confirmed)
- **Storefront** (Next.js) → Vercel → `hoodtopia.co`
- **Store API** (Medusa) → Node host → `api.hoodtopia.co`
- **Admin** (Medusa `/app`) → same Node host → `admin.hoodtopia.co`
- **Backend hosting:** **Fly.io** (user's account) — Medusa as a Fly app, **Fly Postgres** for the DB, optional **Upstash Redis** (Fly add-on) for Medusa's event bus/workflow engine in prod.

## Decisions (confirmed with user)
- **Layout:** Monorepo via npm/pnpm workspaces. **Add `medusa/` beside the current app now**; keep storefront in `src/` (promote to `apps/storefront` in a later, separate effort). Root `package.json` gains `workspaces`.
- **Kustom:** **Kept, data swapped.** Kustom iframe/shipping/push all stay. Their payloads are now built from a **Medusa cart** instead of Drizzle rows.
- **Order truth:** **Medusa.** Kustom push webhook → complete Medusa cart → Medusa Order (paid). Drop the Drizzle `orders` table + `src/app/api/kustom/push` local upsert (rewire to Medusa).
- **Scope:** Everything ecommerce on Medusa — products, variants, images, cart, inventory, regions/currency, orders. AI chat, custom designs, personas, currency UX **stay in the storefront** but read product/cart data from Medusa.
- **Commits:** Many tiny commits, each with a message explaining the Medusa concept it introduces.

## What stays untouched
- `src/services/ai.ts`, `src/server/routers/ai.ts` — AI chat (provider-agnostic; just needs a product list).
- `src/server/routers/custom-designs.ts`, `src/services/image-generation.ts` — Gemini image gen. Custom designs become a Medusa product/variant created on demand (see Phase 6).
- `src/lib/shopper-profiles.tsx`, persona/Generative-UX components.
- `src/lib/currency.tsx` UX — but currency/markets now map to **Medusa regions** (Phase 3).
- **All of `src/lib/kustom/**` and `src/app/api/kustom/**`** — kept; only their *data source* changes (`cart-mapper.ts` input shape, and `push` target).

---

## Implementation — bite-sized commits

> Each numbered item = roughly one commit. Commit messages should name the Medusa concept (e.g. "feat(medusa): seed products via Product Module workflow").

### Phase 0 — Monorepo + Medusa backend scaffold ✅ DONE
> **Implementation note (decided during build):** Medusa is **NOT** an npm
> workspace. Its CLI loads `medusa-config.ts` via a ts-node `require()` hook that
> breaks when `@medusajs/medusa` and `@medusajs/framework`/`cli` get hoisted to
> different `node_modules` levels by npm workspaces. So `medusa/` is a
> **self-contained package** with its own `node_modules` (run `npm install` from
> inside `medusa/`). Both packages still live in one repo. The root
> `package.json` has **no** `workspaces` key.
1. ~~add npm workspaces~~ → **superseded**: self-contained package, no root workspaces key.
2. **`chore(medusa): scaffold MedusaJS v2 backend`** (commit `d430b84`) — hand-scaffolded the v2 backend into `medusa/` (more controllable + better for learning than the interactive `create-medusa-app`). Pinned `@medusajs/* 2.15.5`. `tsconfig.json` needs a `"ts-node": { compilerOptions: { module: "commonjs", moduleResolution: "node" } }` override so the CLI can `require()` the `.ts` config (top-level stays `Node16`). **Do not** set `"type": "module"` (breaks the CommonJS config loader). Verified `medusa build` compiles backend + admin.
3. **`docs(medusa): concept note + env`** (commit `f53c514`) — `medusa/README.md` + `medusa/.env.template`. Template tracked via a `medusa/.gitignore` `!.env.template` negation (root `.gitignore` globs `.env*`).
4. **`chore(medusa): Postgres service + migrations + admin user`** — add `medusa-db` (postgres:16) to `docker-compose.yml` on **host port 5434** (5432/5433 were taken locally). `DATABASE_URL=postgres://medusa:medusa@localhost:5434/medusa`. Run `npx medusa db:migrate` + `npx medusa user`. **Dep gotcha:** `@mikro-orm/*` packages must match Medusa's bundled `@mikro-orm/core` exactly (2.15.5 → `6.6.12`); keep only `@mikro-orm/cli` pinned to that, let the rest come transitively.

> **Local port note:** a `pimir-minio` container squats host port **9000** on this machine, so Medusa runs on **PORT=9009** locally (`PORT=9009 npx medusa develop`). The storefront's `NEXT_PUBLIC_MEDUSA_BACKEND_URL` therefore points at `http://localhost:9009` in dev. Prod is unaffected (api.hoodtopia.co).

### Phase 1 — Model the hoodie catalog in Medusa ✅ DONE
> **Implementation note:** commits 5–9 collapsed into **one** commit (`2c7c8bb`)
> because `createProductsWorkflow` takes options + variants + prices + images in
> a single call — splitting them would be artificial. Built on top of the
> default Medusa **starter seed** (fetched verbatim and adapted), which provides
> the version-correct bootstrap (regions, tax, fulfillment set/service zone,
> shipping options, publishable key). The hand-scaffold did NOT ship these base
> records, so the seed creates them.
5–9. **`feat(medusa): seed Hoodtopia catalog`** (commit `2c7c8bb`):
- `medusa/src/data/catalog.ts` — catalog as plain data ported from `src/db/seed.ts`: 6 hoodies + 13 accessories, 8 colours, 6 sizes, stock buckets, SKU/image helpers (kept verbatim so Kustom `order_lines` match), and `pricesFromUsdCents()` (USD-cents → 5-currency price set).
- `medusa/src/scripts/seed.ts` — bootstrap (sales channel, store currencies, **5 regions one-per-market** US/SE/GB/DE/JP, tax regions, stock location, fulfillment set, Standard/Express shipping options, publishable API key) + `createProductsWorkflow`: hoodies use **Color × Size** options (replaces flat `productVariants`), `colorHex` in variant metadata, `material`/`features`/`featured` in product metadata, per-colour images; accessories = single One Size variant. Inventory set per-variant from the ported buckets.
- **Gotchas hit:** graph relation is `categories` (plural), not `category`; publishable-key var needs a minimal `{id, token?}` type (workflow returns `ApiKeyDTO`, query.graph returns `ApiKey` — they mismatch).
- **Verified vs Postgres:** 19 products, 301 variants (8×6 + 13), all 5 currencies priced, categories + regions present. `medusa build` green.

### Phase 2 — Storefront ↔ Medusa SDK wiring ✅ DONE
10. **`feat(storefront): Medusa JS SDK client`** (commit `be5bf68`) — `src/lib/medusa.ts` exports `new Medusa({ baseUrl, publishableKey })`. **Install only `@medusajs/js-sdk`** — the standalone `@medusajs/types` drags a `vite@5` peer that clashes with the storefront's `vite@7`. **Critical side-task:** exclude `medusa/` from the storefront's `tsconfig.json` **and** `eslint.config.mjs` — otherwise the storefront's `tsc`/`eslint` sweep the backend's `.ts` files and fail on `@medusajs/framework` imports. Verified `sdk.store.product.list()` hits the live backend (19 products, 5 regions).
11. **`feat(storefront): product adapter`** (commit `52521de`) — `src/lib/commerce/product-adapter.ts` maps Medusa Store products/variants → the Drizzle `Product`/`ProductVariant`/`ProductImage` shape the UI/AI already consume. **Key details:** `calculated_price.calculated_amount` ×100 (Medusa returns **major units**, UI's `formatPrice` wants **cents**); `metadata.features` → `JSON.stringify` (UI does `JSON.parse(product.features)`); option titles Color/Size → color/size; `metadata.colorHex` → colorHex; Medusa ids kept as opaque `id`s (cart API needs them). Store API shapes defined locally (avoids the `@medusajs/types` vite peer). Verified against live data — exact field parity.

### Phase 3 — Move the products router to Medusa
### Phase 3 — Move the products router to Medusa ✅ DONE
> **Implementation note:** commits 12–15 collapsed into **one** (`21cf5dd`) since
> every procedure shares the same fetch+adapt path via a new helper. Commit 16
> (force region pricing into the products router) was **dropped as unnecessary**
> — see below.
12–15. **`feat: products router reads from Medusa`** (commit `21cf5dd`) — `src/lib/commerce/medusa-products.ts` wraps the Store calls (`listProducts`/`getProductById`/`getProductByHandle`, shared `PRODUCT_FIELDS`, `resolveRegionId`, `resolveCategoryId`); `products.ts` rewritten so every procedure keeps its name/input/output. `featured` filtered **in memory** (it's in product `metadata`, not queryable). Category filter → `category_id` resolved at query time (ids regenerate on reseed). Read procedures gained an optional `currency` input (string inputs still work via `z.union`). **Verified through the running storefront**: `products.featured`/`bySlug` over tRPC return Medusa data (5999 cents, 48 variants, 8 colors, features as JSON), homepage `GET /` → 200.
16. ~~regions/currency → products router~~ → **DROPPED**: the storefront's `formatPrice` (`src/lib/currency.tsx`) already does client-side USD-cents→currency conversion, and it matches Medusa's region prices within FX rounding (e.g. SEK 651 client vs 648 Medusa). Forcing server region-pricing into the products router would churn `formatPrice`/`convertPrice` for no visible gain. Medusa's **region prices become authoritative only at cart/checkout** (Phase 4–5), where Kustom needs the exact per-currency `unit_price`. The optional `currency` input is left as scaffolding.

### Phase 4 — Move the cart to Medusa
> Replace the Drizzle cart with a real **Medusa cart**. Rewrite `src/server/routers/cart.ts` to proxy the Store cart API. Cart id stored per demo session (cookie), replacing `DEMO_SESSION_ID` + `carts`/`cartItems` tables. Inventory becomes Medusa's job — **delete the manual `adjustStock` logic**.
17. **`feat: cart.get via Medusa`** — `sdk.store.cart.retrieve` (create if missing, store cart_id in an httpOnly cookie keyed to the demo session). Compute `subtotal`/`itemCount` from Medusa cart totals; map line items through the adapter so cart UI is unchanged.
18. **`feat: cart.addItem via Medusa`** — `sdk.store.cart.createLineItem({ variant_id, quantity })`. Drop manual stock decrement (Medusa reservations handle it). Out-of-stock → surfaced from Medusa error.
19. **`feat: cart.updateQuantity/removeItem via Medusa`** — `updateLineItem` / `deleteLineItem`.
20. **`feat: cart.clear / clearAfterPurchase via Medusa`** — clear = delete line items / new cart; `clearAfterPurchase` becomes a no-op or new-cart (order completion handled in Phase 5).
21. **`feat: cart.getRecommendations reads Medusa cart`** — feed `getCartRecommendations` the Medusa cart's products (via adapter) instead of Drizzle joins. AI service signature unchanged.

### Phase 5 — Kustom checkout fed by Medusa, orders land in Medusa
> Kustom code stays; only its **input** (cart-mapper) and **output** (push handler) change.
22. **`feat(kustom): build order payload from Medusa cart`** — change `cart-mapper.ts` input from `CartItemWithJoins[]` to Medusa cart line items. Each line still produces an `OrderLine` with `reference=sku`, `name="Product (Color / Size)"`, `unit_price` (minor units), VAT math, `image_url`. Reuse `getMarket()`/VAT divisor exactly as today. `checkout.ts` `initCheckout` now loads the Medusa cart instead of Drizzle.
23. **`feat(kustom): push webhook completes Medusa cart`** — `src/app/api/kustom/push/route.ts`: on verified push, instead of upserting the Drizzle `orders` table, **complete the Medusa cart** (`sdk.store.cart.complete` / admin order create) keyed by `merchant_reference1` (session) — producing a paid Medusa **Order**. Keep idempotency (ack once). Concept: **Cart → Order completion**.
24. **`refactor: drop Drizzle orders table + local order reads`** — remove `orders` from `src/db/schema.ts`, the confirmation page reads the order from Medusa (admin/store order API) instead of the local table.
25. **`feat(kustom): express payload + shipping assistant from Medusa`** — `buildExpressOrderPayload` lines come from a Medusa variant lookup; KSA shipping options can stay as the existing fallback or map to Medusa shipping options (keep fallback for now — note in commit).

### Phase 6 — Custom designs as Medusa products
26. **`feat: custom design → Medusa product`** — when a Gemini design is added to cart, create a one-off Medusa product/variant (fixed $100, `category=custom`, `metadata.designId`) via admin API, then add its variant to the Medusa cart. `custom-designs.ts` keeps its generate/refine logic; only `addToCart` changes. Keep `customDesigns` table as the design record (it's not commerce data) OR move design metadata onto the Medusa product — **keep the table** (simpler; it stores Gemini prompts/refinement history).

### Phase 7 — Cleanup, docs, deploy
27. **`refactor: delete dead Drizzle commerce schema`** — remove `products`, `productVariants`, `productImages`, `carts`, `cartItems`, `orders` from `src/db/schema.ts` + their relations/types. Keep non-commerce tables (`userPreferences`, `chatMessages`, `chatSafetyEvents`, `customDesigns`). Remove `src/db/seed.ts` commerce seeding (moved to Medusa). Update `drizzle.config.ts` if needed.
28. **`chore: storefront env + scripts`** — update `package.json` scripts (`dev` runs storefront; add `dev:medusa`, `seed:medusa`), `.env.example`, and `docker-compose.yml` (medusa service + postgres + storefront).
29. **`docs: commit refactor plan + integration doc`** — copy this plan into the repo as **`docs/MEDUSA_REFACTOR_PLAN.md`** (tracked, so the phased commit map lives with the code). Add `docs/MEDUSA_INTEGRATION.md` (how Medusa+Kustom interplay; the order-truth flow). Rewrite README Tech Stack (Medusa replaces Drizzle/SQLite for commerce). Note Kustom is unchanged.
30. **`chore(deploy): Fly.io Medusa backend + subdomain topology`** — deploy the Medusa backend to **Fly.io** and wire the subdomain topology:
    - **Storefront** → Vercel → `hoodtopia.co`
    - **Store API** → Fly app → `api.hoodtopia.co`
    - **Admin** → same Fly app, served at `/app` → `admin.hoodtopia.co`

    Medusa's **admin is served by the backend, not Vercel** (it's a long-running Node server), so it lives on the Fly app. Add `medusa/fly.toml` (Node app, internal port 9000, health check on `/health`) + a production `Dockerfile` for Medusa (build admin + run migrations on release via a `release_command`). Provision **Fly Postgres** (`fly postgres create`) and attach it (`DATABASE_URL` secret); optionally an **Upstash Redis** add-on for the event bus / workflow engine (`REDIS_URL`). Set Fly secrets: `JWT_SECRET`, `COOKIE_SECRET`, `DATABASE_URL`, `REDIS_URL`, CORS vars. Configure in `medusa-config.ts`: `admin.backendUrl = https://api.hoodtopia.co`, `http.storeCors`/`adminCors`/`authCors` listing `https://hoodtopia.co` + `https://admin.hoodtopia.co`, cookie domain. Map both Fly certs/domains: `fly certs add api.hoodtopia.co` + `fly certs add admin.hoodtopia.co` (both resolve to the one Fly app; admin served at `/app`, so `admin.hoodtopia.co` → rewrite/redirect to `/app` or document the `/app` path). Storefront env on Vercel: `NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.hoodtopia.co` + `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`. DNS: `api.` + `admin.` CNAMEs → Fly.

---

## Critical files

**New (Medusa backend):**
- `medusa/medusa-config.ts`, `medusa/src/scripts/seed.ts`, `medusa/.env.template`, `medusa/README.md`

**New (storefront seam):**
- `src/lib/medusa.ts` — SDK client
- `src/lib/commerce/product-adapter.ts` — Medusa → existing UI/AI shape (the key seam)

**Rewired (logic changes, signatures preserved where possible):**
- `src/server/routers/products.ts` — Store API instead of Drizzle
- `src/server/routers/cart.ts` — Medusa cart instead of Drizzle + manual stock
- `src/server/routers/checkout.ts` — loads Medusa cart for Kustom
- `src/lib/kustom/cart-mapper.ts` — input = Medusa cart line items
- `src/app/api/kustom/push/route.ts` — completes Medusa cart → Medusa order
- `src/lib/currency.tsx` / `src/lib/kustom/markets.ts` — currency ↔ Medusa region
- `src/server/routers/custom-designs.ts` — `addToCart` creates Medusa product

**Deleted/trimmed:**
- Commerce tables in `src/db/schema.ts` + `orders`; commerce parts of `src/db/seed.ts`

**Untouched:** `src/services/ai.ts`, `src/server/routers/ai.ts`, persona/profile + custom-design generation, all Kustom iframe/shipping/element code.

## Verification (end-to-end)
1. **Backend up:** `cd medusa && medusa develop` → admin at `localhost:9000/app` shows 19 products, variants (Color×Size), images, region prices.
2. **Seed check:** `curl localhost:9000/store/products -H "x-publishable-api-key: <key>"` returns hoodies.
3. **Storefront reads Medusa:** `npm run dev` → home/PDP/listing render products from Medusa (not SQLite). Color/size selectors work off variant options.
4. **Cart:** add/update/remove items → reflected in Medusa cart (verify line items in admin). Out-of-stock variant blocked by Medusa, not manual stock math.
5. **AI still works:** chat recommendations + cart cross-sell return real Medusa products via the adapter.
6. **Checkout (Kustom unchanged):** `initCheckout` produces a Kustom iframe with correct lines/VAT sourced from the Medusa cart. Complete a Kustom playground payment.
7. **Order truth:** Kustom push webhook fires → a **paid Medusa Order** appears in the admin; confirmation page reads it from Medusa. No row written to a local `orders` table (table is gone).
8. **Custom design:** generate a Gemini design → add to cart → a `custom` Medusa product/variant is created and added to the Medusa cart → flows through Kustom checkout.
9. **CI:** `npm run ci` (lint + typecheck + test + build) passes for the storefront; `cd medusa && npm run build` passes for the backend.
10. **Deploy topology:** `docs/MEDUSA_REFACTOR_PLAN.md` committed; `medusa/fly.toml` + prod Dockerfile present. `fly deploy` brings the Medusa app up on **Fly.io**, migrations run on release, Fly Postgres attached. Verify `https://api.hoodtopia.co/health` is green, admin loads at `https://admin.hoodtopia.co`, and the Vercel storefront (`hoodtopia.co`) reads products from it via `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.

## Open follow-ups (out of scope for this PR)
- Promote storefront to `apps/storefront` (full restructure).
- Map KSA live shipping options to Medusa shipping options (currently kept as fallback).
- Move custom-design metadata fully onto Medusa products (currently kept in `customDesigns` table).
