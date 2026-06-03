# syntax=docker/dockerfile:1.7
# Production image for the Hoodtopia MedusaJS backend.
#
# Medusa's `build` compiles the backend + admin into .medusa/server, which is a
# self-contained app with its OWN package.json. We build there, install prod
# deps, and run `predeploy` (migrations) + `start` at container start.
#
# Speed: `npm ci` (deterministic, no resolution) + a BuildKit cache mount on
# ~/.npm so package tarballs are reused across builds — the first build still
# downloads Medusa's large dep tree, but rebuilds are much faster.

# ── Builder ──────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# System deps some native modules need.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install deps first (cached unless package*.json changes). Cache mount on the
# npm download cache survives across builds even when the lockfile changes.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci || npm install

COPY . .

# The admin dashboard's backend URL is baked at BUILD time (medusa-config.ts
# reads MEDUSA_BACKEND_URL). It's a Fly runtime secret, so it isn't present
# during `medusa build` unless passed as a build arg — without it the admin
# defaults to http://localhost:9010 and login CORS-fails in prod.
ARG MEDUSA_BACKEND_URL=http://localhost:9010
ENV MEDUSA_BACKEND_URL=${MEDUSA_BACKEND_URL}

# Compile backend + admin → .medusa/server
RUN npx medusa build

# ── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# The built server is self-contained under .medusa/server.
COPY --from=builder /app/.medusa/server ./

# Install only the production deps of the built server (cached npm downloads).
# `medusa build` generates this package-lock; fall back to `npm install` if it
# isn't perfectly in sync with package.json (ci is strict about that).
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev || npm install --omit=dev

# Medusa listens on 9000 inside the container (Fly maps it via fly.toml).
EXPOSE 9000

# Run migrations (predeploy) then start. Migrations are idempotent.
CMD ["sh", "-c", "npm run predeploy && npm run start"]
