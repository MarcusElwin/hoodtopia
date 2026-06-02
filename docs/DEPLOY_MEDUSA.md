# Deploying the MedusaJS backend to Fly.io

The Hoodtopia **storefront** deploys to Vercel (see [`DEPLOY.md`](./DEPLOY.md)).
The **MedusaJS backend** (catalog/cart/orders + admin) is a long-running Node
server, so it can't run on Vercel — it deploys to **Fly.io** with managed
PostgreSQL.

## Production topology

| Piece | Host | URL |
| --- | --- | --- |
| Storefront (Next.js) | Vercel | `hoodtopia.co` |
| Store/Admin API (Medusa) | Fly.io | `api.hoodtopia.co` |
| Admin dashboard | Fly.io (Medusa `/app`) | `admin.hoodtopia.co` |
| Database | Fly Postgres | — |
| Redis (optional) | Upstash / Fly | — |

The Medusa **admin is served by the backend** (not Vercel). `api.` and `admin.`
both point at the same Fly app; the admin lives at `/app`.

## Files

- `medusa/Dockerfile` — multi-stage build: compiles `.medusa/server`, installs
  prod deps, runs `predeploy` (migrations) then `start` at container boot.
- `medusa/fly.toml` — Fly app config (internal port 9000, `/health` check).
- `medusa/.dockerignore`.

## One-time setup

Run from inside `medusa/`:

```bash
# 1. Create the Fly app (uses the committed fly.toml; don't deploy yet)
fly launch --no-deploy --copy-config
#    → confirm app name (hoodtopia-medusa) + region

# 2. Managed Postgres + attach (sets the DATABASE_URL secret on the app)
fly postgres create --name hoodtopia-db
fly postgres attach hoodtopia-db

# 3. Secrets (CORS uses the real domains; admin POSTs auth to api.hoodtopia.co)
fly secrets set \
  JWT_SECRET=$(openssl rand -hex 32) \
  COOKIE_SECRET=$(openssl rand -hex 32) \
  STORE_CORS=https://hoodtopia.co \
  ADMIN_CORS=https://admin.hoodtopia.co \
  AUTH_CORS=https://hoodtopia.co,https://admin.hoodtopia.co \
  MEDUSA_BACKEND_URL=https://api.hoodtopia.co

# Optional: move cache/event-bus/workflow engine onto Redis for multi-instance
# fly secrets set REDIS_URL=redis://<upstash-host>:6379

# 4. Deploy (Dockerfile build → migrations run on boot)
fly deploy

# 5. Custom domains (both resolve to the same app; admin served at /app)
fly certs add api.hoodtopia.co
fly certs add admin.hoodtopia.co
#    → add the CNAME/A records Fly prints, at your DNS provider

# 6. Seed the catalog once + create an admin user
fly ssh console -C "npm run seed"
fly ssh console -C "npm run seed:extras"
fly ssh console -C "npx medusa user -e admin@hoodtopia.co -p <strong-pw>"
```

`npm run seed:extras` prints the **publishable** key (`pk_…`) and the **admin
secret** key (`sk_…`). Put them in the storefront's Vercel env (next section).

## Wire the storefront (Vercel)

Set these in the Vercel project (Production):

```
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.hoodtopia.co
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_…      # from `npm run seed`/`seed:extras`
MEDUSA_ADMIN_API_KEY=sk_…                    # server-only; for custom-design products
```

(Plus the existing OpenAI/Gemini/Kustom vars from `DEPLOY.md`.)

## DNS

| Record | Points at |
| --- | --- |
| `hoodtopia.co` (A/ALIAS) | Vercel |
| `api.hoodtopia.co` (CNAME) | Fly (`fly certs add` output) |
| `admin.hoodtopia.co` (CNAME) | Fly (same app) |

No Vercel proxy is needed — the subdomains point straight at Fly.

## Notes

- **Build time**: the image is large (~1.3 GB) and `npm install` of Medusa's
  dependency tree is slow (10–20 min on a cold cache locally; Fly's remote
  builders + layer caching make redeploys much faster). The Dockerfile is
  verified to build and produce a runnable image.
- **Migrations** run automatically on every deploy via the Dockerfile
  `predeploy` step (idempotent).
- **Admin URL**: open `https://admin.hoodtopia.co/app`. If a login hits an
  unexpected origin, check `MEDUSA_BACKEND_URL` and the `*_CORS` secrets.
- **Redis** is optional but recommended in prod (the in-memory event
  bus/workflow engine doesn't survive restarts or scale across machines).
- **Scaling**: `fly scale count 2` works once `REDIS_URL` is set.
