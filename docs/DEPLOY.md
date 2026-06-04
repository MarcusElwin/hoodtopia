# Deploying Hoodtopia to Vercel + hoodtopia.co

Step-by-step guide for shipping the Kustom-integrated demo to a real domain. Assumes you've bought `hoodtopia.co` and have a Vercel account.

> **This guide covers the storefront (Vercel).** Commerce now runs on a
> MedusaJS backend that deploys separately to **Fly.io** — see
> [`DEPLOY_MEDUSA.md`](./DEPLOY_MEDUSA.md). Deploy the backend first, then set
> the storefront's `NEXT_PUBLIC_MEDUSA_*` and `MEDUSA_ADMIN_API_KEY` env vars.

---

## 1. Create the Vercel project

```bash
# In the repo root
vercel link              # follow prompts → create new project named "hoodtopia"
```

Or via the dashboard: <https://vercel.com/new> → import from `MarcusElwin/ai-in-ecommerce-langchain-meetup-sto`.

Production branch: `main` (merge `feat/kustom-integration` first).

---

## 2. Add environment variables

The fastest path is the CLI:

```bash
# Server-only Kustom credentials
vercel env add KUSTOM_API_BASE_URL    production preview
# → https://api.playground.kustom.co (production for now; switch to api.kustom.co when live)

vercel env add KUSTOM_USERNAME        production preview
# → MID-<randomsuffix>

vercel env add KUSTOM_API_KEY         production preview
# → kco_test_api_...

vercel env add KUSTOM_MERCHANT_ID     production preview
# → PM00138210

# Site URL — different per environment
vercel env add NEXT_PUBLIC_SITE_URL   production
# → https://hoodtopia.co

vercel env add NEXT_PUBLIC_SITE_URL   preview
# → https://hoodtopia-git-<branch>-<scope>.vercel.app
#   (or use VERCEL_URL at runtime — see "Dynamic preview URLs" below)

# Shipping Assistant secrets
vercel env add KUSTOM_SHIPPING_KEY         production preview
# → openssl rand -hex 32

vercel env add KUSTOM_SHIPPING_JWT_SECRET  production preview
# → openssl rand -hex 32

# On-site Elements (browser-visible)
vercel env add NEXT_PUBLIC_KUSTOM_ELEMENTS_SRC   production preview
# → URL from Kustom Portal → Elements section

vercel env add NEXT_PUBLIC_KUSTOM_MERCHANT_ID    production preview
# → PM00138210 (same as KUSTOM_MERCHANT_ID)

# AI keys (already used elsewhere)
vercel env add OPENAI_API_KEY  production preview
vercel env add GEMINI_API_KEY  production preview
```

Verify with `vercel env ls`.

### Dynamic preview URLs (optional)

Preview deployments get a fresh URL each push, which breaks any KSA portal configuration pinned to a single host. Two options:

- **Pinned preview domain:** Vercel → Project Settings → Domains → add `preview.hoodtopia.co` and assign it to the preview environment. Then `NEXT_PUBLIC_SITE_URL=https://preview.hoodtopia.co` in preview.
- **Skip KSA on previews:** set `KUSTOM_SHIPPING_KEY` to empty in preview; our `cart-mapper.ts` defaults to the static fallback shipping options. Easier.

---

## 3. Attach the domain

Vercel Dashboard → Project → Settings → Domains → **Add Domain** → `hoodtopia.co`.

Vercel shows the DNS records you need to set. At your registrar:

| Type  | Name | Value |
|-------|------|-------|
| `A`   | `@`  | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

(Vercel may give slightly different values — use whatever the dashboard shows. Propagation is usually < 5 min, max 24h.)

Add `www.hoodtopia.co` too and set it to redirect to the apex.

---

## 4. Configure the Kustom Portal for the new host

### A. Allowed redirect domains (Checkout)

Portal → API → Settings → **Allowed return URLs** (or similar) → add:
- `https://hoodtopia.co`
- `https://www.hoodtopia.co`
- `https://preview.hoodtopia.co` (if using pinned preview)

This is what stops the iframe from refusing to redirect to `merchant_urls.confirmation`.

### B. Kustom Shipping Assistant (KSA) profile

Portal → Integrations → **Shipping** → Create profile:
- **Endpoint:** `https://hoodtopia.co/api/kustom/shipping`
- **Identifier:** `hoodtopia-demo`
- **Shared secret:** the value of `KUSTOM_SHIPPING_KEY` you set above
- **Markets:** GB (and CH/PL if you want to demo multi-market)

Attach the profile to MID `PM00138210`. KSA will start calling `POST /api/kustom/shipping/auth` followed by `POST /api/kustom/shipping/options` on every address change inside the checkout iframe.

### C. On-site Elements allowed domains

Portal → Elements → **Allowed domains** → add:
- `hoodtopia.co`
- `www.hoodtopia.co`
- `preview.hoodtopia.co`
- `localhost:3000` (for `npm run dev`)

Without this, the loader script refuses to render `<kustom-payment-method-display>` on those origins.

---

## 5. Deploy

```bash
vercel --prod
# or just push to main — Vercel auto-builds
```

First deploy takes ~2 min. Watch the Function logs for any startup errors (most commonly: missing env var).

---

## 6. Verify end-to-end

1. **Hit `https://hoodtopia.co/cart`** → add a hoodie → Proceed to Checkout.
2. **Iframe loads** → Kustom KCO renders. If you see "blocked by allowed-domains," fix step 4A.
3. **Enter an address** → DevTools → Network tab inside the iframe → you should see `POST /auth` then `POST /shippingoptions` hit `hoodtopia.co`. If not, fix step 4B.
4. **Complete with test customer** (`Testperson-se@kustom.co` + Kustom test payment) → land on `/checkout/confirmation?order_id=…`.
5. **Within ~5 min:** check Vercel function logs for `/api/kustom/push` — should log a successful sync.
6. **DB sync:** open `db/hoodtopia.db` via `npm run db:studio` (only works locally; on Vercel the SQLite file is ephemeral, see "SQLite caveat" below).
7. **PDP / cart:** payment-method icons render under price and total. If not, fix step 4C.

---

## 7. SQLite caveat (important)

The current `orders` table lives in `db/hoodtopia.db` — a local file. On Vercel, the filesystem is **read-only at runtime** and **ephemeral between deploys**. The push webhook will silently fail to persist orders in production.

Three options, ordered by effort:

| Option | Setup | Tradeoff |
|---|---|---|
| **Skip persistence for the demo** | Comment out the `db.insert/update` calls in `src/app/api/kustom/push/route.ts`; keep the acknowledge call | Simplest. No order history in the UI, but the demo flow still works end-to-end. |
| **Vercel Postgres / Neon** | Provision via Vercel Marketplace → swap Drizzle's `better-sqlite3` driver for `postgres-js` and run `db:push` to create the table on Postgres | Real persistence. ~30 min of work. |
| **Turso (SQLite at the edge)** | `turso db create hoodtopia` → swap driver for `@libsql/client` | Keeps SQLite semantics. Free tier is generous. |

For the meetup demo, **option 1** is fine. Long-term, **Turso** wins for minimum-friction migration since the schema stays identical.

---

## 8. Post-deploy checklist

- [ ] `https://hoodtopia.co` resolves and serves the home page
- [ ] `vercel env ls` shows every Kustom var in both environments
- [ ] `https://hoodtopia.co/api/kustom/push` returns `405` (POST-only) on GET — proves the route is registered
- [ ] `https://hoodtopia.co/api/kustom/shipping/auth` returns `400` with `{"error":"invalid_request"}` on `POST {}` — proves auth is wired
- [ ] KSA portal profile shows green status (test ping passes)
- [ ] Elements `<kustom-payment-method-display>` renders under PDP price
- [ ] Order confirmation page shows line items, address, AI recommendations

---

## 9. Switching to Production (when ready)

1. Replace the playground credentials with live ones (`KUSTOM_API_BASE_URL=https://api.kustom.co`, new `KUSTOM_API_KEY` starting with `kco_live_api_`).
2. Re-do the KSA profile and Elements config in the **production** Kustom Portal (separate from playground).
3. Bump VAT, currencies, and supported countries in `src/lib/kustom/cart-mapper.ts` to match your real catalog.
4. Move the SQLite store to a managed Postgres or Turso (see section 7).
5. Set `KUSTOM_API_BASE_URL` in Vercel production env to `https://api.kustom.co`.

---

## References

- `docs/KUSTOM_INTEGRATION.md` — integration architecture
- [Kustom Portal — Playground](https://portal.playground.kustom.co/)
- [Vercel custom domains](https://vercel.com/docs/projects/domains/add-a-domain)
