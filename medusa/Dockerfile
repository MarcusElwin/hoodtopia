# Production image for the Hoodtopia MedusaJS backend.
#
# Medusa's `build` compiles the backend + admin into .medusa/server, which is a
# self-contained app with its OWN package.json. We build there, install prod
# deps, and run `predeploy` (migrations) + `start` at container start.

# ── Builder ──────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# System deps some native modules need.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Compile backend + admin → .medusa/server
RUN npx medusa build

# ── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# The built server is self-contained under .medusa/server.
COPY --from=builder /app/.medusa/server ./

# Install only the production deps of the built server.
RUN npm install --omit=dev

# Medusa listens on 9000 inside the container (Fly maps it via fly.toml).
EXPOSE 9000

# Run migrations (predeploy) then start. Migrations are idempotent.
CMD ["sh", "-c", "npm run predeploy && npm run start"]
