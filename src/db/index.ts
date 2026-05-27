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
//
// Lazy init: createClient opens the file/HTTP connection eagerly, which Next
// triggers during build's "Collecting page data" pass on any route that
// imports this module. The build sandbox has no TURSO_DATABASE_URL and no
// db/hoodtopia.db, so it crashes with ConnectionFailed(14). We defer the
// connection to first query via a Proxy so module load is side-effect-free.

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let cached: DrizzleDb | null = null;
function getDb(): DrizzleDb {
  if (cached) return cached;
  const url = process.env.TURSO_DATABASE_URL ?? "file:./db/hoodtopia.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  cached = drizzle(client, { schema });
  return cached;
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export * from "./schema";
