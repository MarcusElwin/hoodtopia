import { loadEnv, defineConfig } from "@medusajs/framework/utils"

// Load the right .env file for the current NODE_ENV (.env, .env.production, …).
// Must run before defineConfig so process.env is populated.
loadEnv(process.env.NODE_ENV || "development", process.cwd())

/**
 * Hoodtopia Medusa backend configuration.
 *
 * Concepts:
 * - `projectConfig.databaseUrl` points at PostgreSQL (Medusa's only supported DB).
 * - `http.*Cors` whitelists the origins allowed to call the Store/Admin/Auth APIs.
 *   In dev these are the storefront (:3000) + admin (:9000). In prod they become
 *   hoodtopia.co / admin.hoodtopia.co (see docs/MEDUSA_INTEGRATION.md).
 * - `admin.backendUrl` is the URL the admin dashboard uses to reach this server.
 *   Locally that's http://localhost:9000; in prod it's https://api.hoodtopia.co.
 * - `redisUrl` (optional) moves the cache / event bus / workflow engine onto Redis.
 *   Without it Medusa uses in-memory implementations — fine for local dev, not prod.
 */
module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Redis is optional locally; when REDIS_URL is set the modules below use it.
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    // URL the bundled admin dashboard POSTs to (login, API calls). MUST match
    // the port Medusa actually listens on. Locally that's :9009 (a pimir-minio
    // container squats :9000 — pointing here at :9000 makes the admin send
    // /auth/* to MinIO, which returns an S3 error). Prod: https://api.hoodtopia.co.
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9010",
  },
  // When REDIS_URL is present, route the infra modules through Redis so multiple
  // instances share cache/events/workflow state. Omitted entirely otherwise.
  modules: process.env.REDIS_URL
    ? [
        {
          resolve: "@medusajs/medusa/cache-redis",
          options: { redisUrl: process.env.REDIS_URL },
        },
        {
          resolve: "@medusajs/medusa/event-bus-redis",
          options: { redisUrl: process.env.REDIS_URL },
        },
        {
          resolve: "@medusajs/medusa/workflow-engine-redis",
          options: { redis: { url: process.env.REDIS_URL } },
        },
      ]
    : [],
})
