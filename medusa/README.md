# Hoodtopia — MedusaJS commerce backend

This is the [MedusaJS v2](https://docs.medusajs.com/) backend that owns Hoodtopia's
commerce data: **products, variants, images, inventory, cart, regions/pricing, and
orders**. The Next.js app in the repo root is now a **storefront** that talks to
this backend over Medusa's Store API.

> **Why it lives in its own package:** Medusa is a standalone Node server, not a
> library you import into Next.js. It runs its own process, owns a PostgreSQL
> database, and serves an admin dashboard. It installs in isolation (its own
> `node_modules`) because Medusa's CLI loads `medusa-config.ts` through a ts-node
> hook that breaks under npm-workspace hoisting.

## Mental model

| Piece | Where | Port (dev) | URL (prod) |
| --- | --- | --- | --- |
| Storefront (Next.js) | repo root (`src/`) | 3000 | `hoodtopia.co` (Vercel) |
| Store/Admin API (this) | `medusa/` | 9000 | `api.hoodtopia.co` (Fly.io) |
| Admin dashboard | served by this at `/app` | 9000/app | `admin.hoodtopia.co` |

- **Store API** (`/store/*`) — what the storefront calls (products, carts). Scoped
  by a *publishable API key* tied to a sales channel.
- **Admin API** (`/admin/*`) + **dashboard** (`/app`) — where you manage the catalog,
  inventory, and orders.
- **Kustom** stays the payment step: Medusa owns the cart, Kustom takes payment,
  and the Kustom push webhook completes the Medusa cart into a paid Medusa order.
  See `../docs/MEDUSA_INTEGRATION.md`.

## Local setup

```bash
# 1. Postgres must be running (see ../docker-compose.yml `db` service)
# 2. Configure env
cp .env.template .env          # then edit DATABASE_URL etc.

# 3. Install (isolated — run from THIS directory, not the repo root)
npm install

# 4. Create the schema
npx medusa db:migrate

# 5. Create an admin user for the dashboard
npx medusa user -e admin@hoodtopia.co -p supersecret

# 6. Run it (API + admin on :9000)
npm run dev
```

Admin dashboard: <http://localhost:9000/app>

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `medusa develop` — API + admin with hot reload |
| `npm run build` | `medusa build` — compile backend + admin bundle |
| `npm run start` | `medusa start` — production server |
| `npm run seed` | `medusa exec ./src/scripts/seed.ts` — seed the catalog |
| `npx medusa db:migrate` | run database migrations |
| `npx medusa user -e <email> -p <pw>` | create an admin user |

## Source layout (`src/`)

Standard Medusa v2 structure — each directory is auto-loaded by the framework:

- `api/` — custom API routes
- `modules/` — custom commerce modules (data models + service)
- `workflows/` — multi-step business logic (used by the seed script)
- `subscribers/` — event handlers
- `jobs/` — scheduled jobs
- `links/` — module links (associations across modules)
- `admin/` — admin dashboard widgets / UI routes
- `scripts/` — CLI scripts run via `medusa exec` (e.g. `seed.ts`)
