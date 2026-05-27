import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Single DB layer that talks to either:
//   - Turso (remote, used in production / Vercel) when TURSO_DATABASE_URL is set
//   - A local libSQL file (file:./db/hoodtopia.db) otherwise
//
// libSQL is wire-compatible with SQLite so the existing schema + queries work
// unchanged. The seed script imports this same client so `npm run db:seed`
// targets local or Turso depending on the env vars present at run time.
const url = process.env.TURSO_DATABASE_URL ?? "file:./db/hoodtopia.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });
export const db = drizzle(client, { schema });

export * from "./schema";
