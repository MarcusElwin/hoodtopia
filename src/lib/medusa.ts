import Medusa from "@medusajs/js-sdk"

/**
 * Medusa JS SDK client — the storefront's gateway to the Medusa backend's
 * Store API (products, carts, regions, orders).
 *
 * Concepts:
 * - `baseUrl` points at the Medusa server. Locally that's http://localhost:9009
 *   (a pimir-minio container squats :9000 on this machine; prod uses
 *   https://api.hoodtopia.co). Override with NEXT_PUBLIC_MEDUSA_BACKEND_URL.
 * - `publishableKey` scopes every Store API request to a sales channel. It's
 *   created by the seed and printed in its logs; paste it into
 *   NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY. Without it, /store/* returns 400.
 *
 * This module is imported by the tRPC routers (server side), which act as the
 * storefront's BFF — UI components keep calling tRPC and never touch Medusa
 * directly.
 */

export const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9009"

export const MEDUSA_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export const medusa = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  publishableKey: MEDUSA_PUBLISHABLE_KEY,
})

/**
 * Admin-authenticated client for the few server-only writes the storefront
 * needs (e.g. creating a one-off product for a custom AI design). Uses a secret
 * API key — SERVER ONLY, never exposed to the browser. Create one with the
 * Medusa CLI / seed and set MEDUSA_ADMIN_API_KEY.
 */
export const MEDUSA_ADMIN_API_KEY = process.env.MEDUSA_ADMIN_API_KEY || ""

export const medusaAdmin = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  apiKey: MEDUSA_ADMIN_API_KEY,
})
