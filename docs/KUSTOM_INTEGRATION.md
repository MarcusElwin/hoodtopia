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

## 9. Roadmap — Checkout Callbacks (next PR)

Beyond the four `merchant_urls` Hoodtopia sends today (`terms`, `checkout`, `confirmation`, `push`), Kustom supports six **server-side callback URLs** that fire mid-checkout for richer UX:

| Key | Purpose | When Kustom calls it |
|---|---|---|
| `address_update` | Recompute totals for a new address | User edits shipping/billing address |
| `country_change` | Switch tax/currency/options on country swap | User picks a new country |
| `shipping_option_update` | Recompute on shipping-option swap | User picks a different shipping option |
| `validation` | Final server-side check before payment | Just before "Pay now" |
| `upsell` | Inject extra `order_lines[]` on confirmation page | After purchase complete |
| `upsell_validation` | Validate an upsell selection | User clicks an upsell offer |

All six follow the same contract: Kustom `POST`s the current order, you return `{ order_lines, order_amount, order_tax_amount, ... }` (or `{ error }`). Response time budget is ~5 s before Kustom falls back to the cached state.

Planned scope (split into a separate PR after the current one merges):

1. **Routes:** `src/app/api/kustom/callbacks/{address,country,shipping-option,validation}/route.ts` — each takes the order, runs the same `buildCreateOrderPayload` math against the new inputs, and returns the recomputed lines.
2. **Auth:** these callbacks are server-to-server from Kustom; protect with the same shared-secret HMAC pattern as the push webhook, or a `?token=` query param (Kustom doesn't sign callback requests by default).
3. **`merchant_urls`:** extend `cart-mapper.ts` to emit the four URLs above.
4. **`options.require_validate_callback_success: true`:** flip on to force Kustom to wait for our `validation` callback before authorising payment.
5. **Upsells:** the `upsell` callback is where Hoodtopia's existing AI recommendation engine becomes a revenue lever — return 1-3 complementary products from `getCartRecommendations` and they render inside the Kustom confirmation iframe before the customer leaves.

Reference: cached at `.firecrawl/kustom/api-checkout-callback.md` (full payload examples for all six callback types).

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
