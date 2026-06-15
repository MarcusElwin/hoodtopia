# Kustom Checkout Integration

Hoodtopia integrates [Kustom Checkout](https://docs.kustom.co/contents/checkout) (KCO) directly via the REST API. The integration covers three layers, each landed in a dedicated commit:

1. **Checkout flow** — Create Order → Render Snippet → Read Order → Render Confirmation, plus a push-notification webhook that syncs orders and acknowledges via the Order Management API.
2. **Shipping Assistant** — Hoodtopia implements the Integrator side of Kustom Shipping Assistant (KSA) so checkout can fetch live shipping options instead of static fallbacks.
3. **On-site Elements** — `<kustom-payment-method-display>` on product detail pages and the cart so shoppers see available payment methods before entering checkout.

This document walks through configuration, the request/response shapes, and how to verify everything against the **Playground** environment.

---

## 1. Get Playground access

1. Go to <https://portal.playground.kustom.co/onboarding>.
2. Fill in the onboarding form (store name + email).
3. Confirm via the magic link / SSO and open the **Playground Portal**.
4. Create an API credential — you'll get a username in the form `MID-<random>` and an API key starting with `kco_test_api_`.

> **Production vs Playground:** the API key prefix (`kco_test_` vs `kco_live_`) and base URL (`api.playground.kustom.co` vs `api.kustom.co`) determine the environment. Hoodtopia defaults to Playground.

---

## 2. Environment variables

Add the following to `.env.local` (see `env.example` for the canonical list):

```bash
# Server-only — never expose with NEXT_PUBLIC_*
KUSTOM_API_BASE_URL=https://api.playground.kustom.co
KUSTOM_USERNAME=MID-xxxxxxxx
KUSTOM_API_KEY=kco_test_api_xxxxxxxxxxxx
KUSTOM_MERCHANT_ID=xxxxxxxx

# Must be a publicly reachable URL for the push webhook to fire in real flows
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Shipping Assistant (Commit 2)
KUSTOM_SHIPPING_KEY=<shared-secret-min-32-chars>
KUSTOM_SHIPPING_JWT_SECRET=<random-min-32-chars>

# On-site Elements (Commit 3) — safe to expose in the browser
NEXT_PUBLIC_KUSTOM_ELEMENTS_SRC=https://elements.kustom.co/v1/loader.js
NEXT_PUBLIC_KUSTOM_MERCHANT_ID=xxxxxxxx
```

Authentication is HTTP Basic: `Authorization: Basic base64(KUSTOM_USERNAME:KUSTOM_API_KEY)`. The client builds this header automatically in `src/lib/kustom/client.ts`.

---

## 3. Checkout flow (Commit 1)

### Architecture

```
[Cart page]  →  Proceed to Checkout
     │
     ▼
[/checkout]  ── server component ──┐
     │                              │
     │  appRouter.checkout.initCheckout
     │   └── cart → buildCreateOrderPayload → kustom.createOrder
     ▼
[KCO iframe] (html_snippet rendered by <KustomSnippet/>)
     │
     │  customer completes payment
     ▼
[/checkout/confirmation?order_id=…]
     │  appRouter.checkout.getCheckoutOrder
     │   └── kustom.readOrder → confirmation html_snippet
     ▼
~2 min later:  Kustom → POST /api/kustom/push?order_id=…
                         ├── kustom.getManagementOrder
                         ├── upsert into `orders` (idempotent)
                         └── kustom.acknowledgeOrder
```

### Critical files

| File | Purpose |
|---|---|
| `src/lib/kustom/client.ts` | Server-only fetch wrapper. Exports `createOrder`, `readOrder`, `getManagementOrder`, `acknowledgeOrder`. |
| `src/lib/kustom/types.ts` | Hand-typed payload contracts (mirrors only the fields Hoodtopia touches). |
| `src/lib/kustom/cart-mapper.ts` | Converts cart items to `order_lines[]`. Computes `order_amount` and `order_tax_amount` (SE VAT 25%, inclusive). |
| `src/server/routers/checkout.ts` | tRPC: `initCheckout` (creates the order) and `getCheckoutOrder` (reads it back). |
| `src/components/checkout/kustom-snippet.tsx` | Client wrapper that injects HTML and **recreates `<script>` tags** so they execute. |
| `src/app/checkout/page.tsx` | Server component that renders the KCO iframe. |
| `src/app/checkout/confirmation/page.tsx` | Server component for the confirmation snippet. |
| `src/app/api/kustom/push/route.ts` | Webhook handler. |
| `src/db/schema.ts` (`orders` table) | Local order mirror. |

### Tax math

Hoodtopia prices are stored as **VAT-inclusive cents (öre)** in SEK. Per line:

```ts
total_amount     = unit_price * quantity
total_tax_amount = total_amount - round(total_amount / 1.25)   // SE VAT 25%
```

Wrong tax values cause Kustom to reject the order with a 400 — keep the math centralized in `cart-mapper.ts`.

### Push notification semantics

| Behavior | Detail |
|---|---|
| First push | ~2 minutes after `checkout_complete` |
| Retries on non-2xx | 5 min, 15 min, 30 min, 60 min, then every 4h for 48h |
| Stop retries | Call `POST /ordermanagement/v1/orders/{id}/acknowledge` |
| Hoodtopia's response | Always `200 {ok:true}`. Errors are logged but never propagated as 5xx (avoids 48h retry storms during demos). |
| Idempotency | Upsert keyed on `kustom_order_id` (unique constraint). |

---

## 4. Shipping Assistant (Commit 2)

KSA can either delegate to a TMS partner (Unifaun/nShift/Consignor) or call back to **your** endpoints. Hoodtopia takes the second path — Hoodtopia plays the **Integrator** role and exposes the two endpoints KSA needs.

### Endpoints

#### `POST /api/kustom/shipping/auth`

KSA calls this first to exchange shared-secret credentials for a bearer token.

```jsonc
// Request
{
  "identifier": "hoodtopia-demo",
  "secret": {
    "nonce": "<random>",
    "digest": "<sha256(nonce + KUSTOM_SHIPPING_KEY) as lowercase hex>"
  }
}

// Response (200)
{ "token": "<JWT, HS256, 1h TTL>", "expires_in": 3600 }
```

Verification uses `crypto.timingSafeEqual` over the lowercased hex digest. Wrong digest → `401`.

#### `POST /api/kustom/shipping/options`

KSA calls this with each address change. Bearer token in `Authorization` header.

```jsonc
// Request (subset)
{
  "purchase_country": "SE",
  "purchase_currency": "SEK",
  "billing_address":  { "country": "SE", "postal_code": "112 23", ... },
  "shipping_address": { ... },
  "order_amount": 99800,
  "order_lines": [ ... ]
}

// Response
{
  "preview": false,
  "shipping_options": [
    { "id": "std", "name": "Standard",     "price": 4900, "tax_amount": 980,  "tax_rate": 2500, "preselected": true },
    { "id": "exp", "name": "Express",      "price": 9900, "tax_amount": 1980, "tax_rate": 2500 },
    { "id": "pup", "name": "Pickup point", "price": 2900, "tax_amount": 580,  "tax_rate": 2500 }
  ]
}
```

- `preview: true` is set when only country-level data is known (no postal code) — KCO will refetch once a full address is entered.
- Free Standard above 1000 SEK is implemented in `src/lib/kustom/shipping-options.ts`.

### Activation

Two prerequisites must both hold for KSA to engage:

1. A KSA profile is configured in the Kustom Portal pointing at `https://<your-domain>/api/kustom/shipping` with `identifier=hoodtopia-demo` and `KUSTOM_SHIPPING_KEY` as the shared secret.
2. The Create Order payload sets `options.allow_separate_shipping_address: true` (Hoodtopia's `initCheckout` defaults to `true` as of Commit 2) **or** provides fallback `shipping_options[]` (Hoodtopia provides both).

If our endpoint goes down, KCO falls back to the static `shipping_options[]` in the create-order payload.

### Critical files

| File | Purpose |
|---|---|
| `src/lib/kustom/shipping-auth.ts` | `verifyDigest` + `jose` HS256 `issueBearer`/`verifyBearer`. |
| `src/lib/kustom/shipping-options.ts` | Pure function returning Standard / Express / Pickup options. |
| `src/app/api/kustom/shipping/auth/route.ts` | Token issuer. |
| `src/app/api/kustom/shipping/options/route.ts` | Options endpoint. |

---

## 5. On-site Elements (Commit 3)

[On-site Elements](https://docs.kustom.co/contents/checkout/kustom-elements) are lightweight web components Kustom hosts. The loader script registers custom HTML tags like `<kustom-payment-method-display>` and `<kustom-express-buttons>`. Hoodtopia uses the payment-method display on the PDP and in the cart.

### Wiring

1. Add the loader URL (from the Kustom Portal → Elements section) to `NEXT_PUBLIC_KUSTOM_ELEMENTS_SRC`.
2. In the Portal, add the **allowed domains** for which Elements may render: `localhost:3000`, your Vercel preview wildcard, the production domain.
3. `src/app/layout.tsx` conditionally injects the loader via `next/script` (`strategy="afterInteractive"`).
4. `<PaymentMethodDisplay amount={...} />` (from `src/components/kustom/payment-method-display.tsx`) is dropped under the price on the PDP and under the order total in the cart.

### Hydration safety

Custom elements with shadow DOM can fight React reconciliation. The wrapper uses `useSyncExternalStore` to defer render until after hydration. TS support for the custom tags lives in `src/types/kustom-elements.d.ts`.

---

## 6. Local end-to-end verification

```bash
# 1. Fill in .env.local
cp env.example .env.local
$EDITOR .env.local

# 2. Apply schema (adds the orders table)
npm run db:push

# 3. Start the dev server
npm run dev
```

Then:

1. `http://localhost:3000/products` → add a hoodie to the cart.
2. `/cart` → **Proceed to Checkout**.
3. Use the Kustom test customer:
   - Email: `Testperson-se@kustom.co`
   - Date of birth: `1941-03-21`
   - Test payment per Kustom's [Sample Payment Data](https://docs.kustom.co/contents/checkout/additional-resources/sample-payment-data).
4. Complete checkout → land on `/checkout/confirmation?order_id=…`.
5. Within ~5 min: `orders` row exists with `acknowledgedAt` populated (verify via `npm run db:studio`).

> **Push webhook caveat:** Kustom must be able to reach your push URL. For local testing, use a tunnel (`ngrok`, `cloudflared`, `vercel dev` with a temp deployment) and set `NEXT_PUBLIC_SITE_URL` to the tunnel URL. Otherwise you'll see the order on the confirmation page but no DB row.

### Useful test cases

See `.firecrawl/kustom/test-cases.md` (cached docs) or the [Kustom test-cases page](https://docs.kustom.co/contents/checkout/additional-resources/test-cases) for canonical flows like "place → fully capture → fully refund".

---

## 7. Vercel deployment

```bash
# Add every Kustom var to Preview + Production
for k in KUSTOM_API_BASE_URL KUSTOM_USERNAME KUSTOM_API_KEY KUSTOM_MERCHANT_ID \
         KUSTOM_SHIPPING_KEY KUSTOM_SHIPPING_JWT_SECRET \
         NEXT_PUBLIC_SITE_URL \
         NEXT_PUBLIC_KUSTOM_ELEMENTS_SRC NEXT_PUBLIC_KUSTOM_MERCHANT_ID; do
  vercel env add "$k" preview
  vercel env add "$k" production
done
```

After the first deploy:

- Set `NEXT_PUBLIC_SITE_URL` per environment so `merchant_urls.push` and `merchant_urls.confirmation` resolve correctly.
- Update the KSA profile endpoint in the Kustom Portal to point at the production hostname.
- Add the production + preview domains to the Elements allowed-domains list.

---

## 8. Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `Kustom POST /checkout/v3/orders failed: 400 … tax` | VAT math off (e.g. exclusive vs inclusive) | Keep all math in `cart-mapper.ts`; SE prices are VAT-inclusive |
| Snippet renders but iframe never loads | `<script>` tags not executed | Confirm `KustomSnippet` is mounted — `innerHTML` alone won't execute scripts |
| Push retries every few minutes | Webhook returned 5xx, or acknowledge failed | Webhook always returns 200; ensure `acknowledgeOrder` succeeded (check logs) |
| Shipping section never appears | KSA not triggered or our endpoint unreachable | Verify `allow_separate_shipping_address: true` and that the KSA profile in portal matches deployed URL |
| KSA `/auth` returns 401 in a loop | Digest casing or wrong shared secret | Digest must be lowercase hex of `sha256(nonce + KUSTOM_SHIPPING_KEY)` |
| Elements never render | Domain not allowed in portal | Add `localhost:3000` + Vercel preview wildcard + prod domain in Kustom Portal |
| Hydration warnings around `<kustom-…>` tags | Custom element mounted before loader registered it | Wrapper already defers with `useSyncExternalStore` — keep that pattern |

---

## 9. Checkout Callbacks

Beyond the four required `merchant_urls` (`terms`, `checkout`, `confirmation`, `push`), Hoodtopia also serves six **server-side callbacks** that Kustom hits mid-checkout for richer UX. They're toggled on by setting `KUSTOM_CALLBACK_SECRET` — when blank, the URLs are dropped from `merchant_urls` and Kustom falls back to its own defaults (safe local dev).

| `merchant_urls` key | Route | When Kustom calls it | What we return |
|---|---|---|---|
| `address_update` | `POST /api/kustom/callbacks/address` | User edits shipping/billing address | Recomputed `order_amount` / `order_tax_amount` / `order_lines` |
| `country_change` | `POST /api/kustom/callbacks/country` | User switches purchase country | Same shape as `address_update` |
| `shipping_option_update` | `POST /api/kustom/callbacks/shipping-option` | User picks a different shipping option | Same, plus injects a `shipping_fee` line if missing |
| `validation` | `POST /api/kustom/callbacks/validation` | Just before payment authorise | `200 {}` to approve, `400 {error_type,error_message}` to block — checks current stock vs cart lines |
| `upsell` | `POST /api/kustom/callbacks/upsell` | Confirmation page render | Up to 2 `upsell_lines[]` chosen by `getCartRecommendations` (AI-driven) + a 10-min `last_upsell_time` |
| `upsell_validation` | `POST /api/kustom/callbacks/upsell-validation` | User clicks an upsell offer | `200 {}` after one last stock check |

### Authentication

Kustom **does not sign** callback requests. We bake a per-route HMAC token into the URL itself:

```ts
sig = HMAC_SHA256(KUSTOM_CALLBACK_SECRET, callbackKind).hex()
// merchant_urls.address_update = `${SITE}/api/kustom/callbacks/address?token=${sig}`
```

Every route validates the token with `crypto.timingSafeEqual`. Token leakage risk is low: the worst an attacker can do is POST a fake order, and our handlers either recompute deterministically or reject with `400`.

### The agentic-commerce moment (`upsell`)

The `upsell` route is the headliner. Flow:

1. Customer completes checkout
2. Kustom POSTs us their `order_lines[]` and `max_upsell_amount`
3. We map SKUs → local products, hand them to `getCartRecommendations` with the order's currency
4. AI returns the top complementary products; we pick the first 1-2 that have variants in stock and fit the budget
5. Kustom renders them as one-click "Add to your order" tiles inside the confirmation iframe
6. If the customer clicks one, `upsell_validation` runs a final stock check before Kustom appends it to the captured order

This is "AI recommendations as a revenue surface" — same engine that powers the cart page now lives inside the payment provider's UI.

**Resilience (`src/lib/kustom/upsell.ts`).** `buildUpsell` always tries to return something. If the cart SKUs don't match the catalog, the AI engine errors, or no AI pick is in-stock/in-budget, it falls back to deterministic catalog picks (cheapest in-stock, in-budget products the customer didn't buy). The result carries a `source` (`"ai" | "fallback" | "none"`) and a `warnings[]` list; both routes log the warnings via `console.warn` (`[upsell:callback]` / `[upsell:api]`) and tag the analytics event with `source`. The only hard-empty cases — returned as `{ upsell_lines: [], empty: true }`, never a 500 — are an unreachable catalog, a catalog with nothing in stock/budget, or Kustom signalling `upsell_possible: false`.

### Authenticated REST variant (`POST /api/upsell`)

The Kustom callback above is invoked by Kustom through a URL we register, so it's protected by an HMAC `?token=`. For fetching the **same** AI recommendations directly — e.g. while onboarding/testing the upsell experience outside the checkout iframe — Hoodtopia also exposes a standalone REST endpoint gated by a **Bearer JWT**. Both share `src/lib/kustom/upsell.ts`, so the recommendations are identical.

```jsonc
// 1. Exchange a shared credential for a short-lived token.
//    digest = sha256(nonce + UPSELL_API_KEY) as lowercase hex.
POST /api/upsell/auth
{ "identifier": "onboarding-test", "secret": { "nonce": "<random>", "digest": "<sha256>" } }
// → 200 { "token": "<JWT, HS256, 1h TTL>", "expires_in": 3600 }

// 2. Call the endpoint with the bearer token. Body matches the Kustom
//    upsell callback (order_lines + optional max_upsell_amount / purchase_currency).
POST /api/upsell
Authorization: Bearer <token>
{ "order_lines": [ { "type": "physical", "reference": "<sku>", ... } ], "purchase_currency": "GBP" }
// → 200 { "upsell_lines": [ ... ], "last_upsell_time": "..." }
//   or  200 { "upsell_lines": [], "empty": true }
```

Enable it by setting both `UPSELL_API_KEY` (shared credential) and `UPSELL_API_JWT_SECRET` (server-only HS256 signing key, ≥32 chars). When either is missing, `/api/upsell/auth` returns `503 not_configured` and `/api/upsell` returns `401`. Mirrors the Shipping Assistant auth handshake (§4).

```bash
# Derive the digest + drive the full flow locally:
NONCE=$(openssl rand -hex 16)
DIGEST=$(node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]+process.env.UPSELL_API_KEY).digest('hex'))" "$NONCE")
TOKEN=$(curl -s -X POST localhost:3000/api/upsell/auth \
  -H 'content-type: application/json' \
  -d "{\"identifier\":\"onboarding-test\",\"secret\":{\"nonce\":\"$NONCE\",\"digest\":\"$DIGEST\"}}" | jq -r .token)
curl -s -X POST localhost:3000/api/upsell \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"purchase_currency":"GBP","order_lines":[{"type":"physical","reference":"<sku>","name":"x","quantity":1,"unit_price":0,"tax_rate":2000,"total_amount":0,"total_tax_amount":0}]}'
```

### Flagship guardrail (`validation`)

When `KUSTOM_CALLBACK_SECRET` is set, `options.require_validate_callback_success: true` flips on automatically. Kustom now refuses to authorise payment until we 200 the `validation` callback.

Hoodtopia uses it to catch the demo's most realistic failure mode: a customer reserves the last-1-in-stock at add-to-cart time, then someone else (on stage or off) drains the inventory between cart and Pay. The `validation` route re-reads `productVariants.stock` and rejects with a customer-visible message if anything went negative.

### Required env

```bash
KUSTOM_CALLBACK_SECRET=$(openssl rand -hex 32)
```

That's it — no portal config required. Kustom picks up the callback URLs from the Create Order `merchant_urls`.

### Verification

```bash
# Unauthenticated calls are rejected
curl -X POST $NEXT_PUBLIC_SITE_URL/api/kustom/callbacks/address
# → 401 {"error":"unauthorized"}

# Re-derive the expected token locally:
node -e "console.log(require('crypto').createHmac('sha256',process.env.KUSTOM_CALLBACK_SECRET).update('address').digest('hex'))"
```

In a real checkout, open the iframe's network tab and watch for `POST` requests to `/api/kustom/callbacks/*` as you edit address, change country, swap shipping. The confirmation iframe will show upsell tiles if the AI returns any.

## 10. References

- [Kustom Checkout overview](https://docs.kustom.co/contents/checkout)
- [Create Order](https://docs.kustom.co/contents/checkout/integrate-kco-in-your-ecommerce/create-order)
- [Read Order](https://docs.kustom.co/contents/checkout/integrate-kco-in-your-ecommerce/read-order)
- [Render Confirmation Snippet](https://docs.kustom.co/contents/checkout/integrate-kco-in-your-ecommerce/render-confirmation-snippet)
- [Confirm Purchase / push webhook](https://docs.kustom.co/contents/checkout/additional-resources/confirm-purchase)
- [Authentication](https://docs.kustom.co/contents/api/api-basics/authentication)
- [Shipping Assistant overview](https://docs.kustom.co/contents/checkout/shipping-assistant/overview)
- [Shipping Assistant API integration](https://docs.kustom.co/contents/checkout/shipping-assistant/api-integration)
- [On-site Elements](https://docs.kustom.co/contents/checkout/kustom-elements)
