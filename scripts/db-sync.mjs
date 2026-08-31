/**
 * Applies pending schema changes before a deploy builds.
 *
 * Deliberately *not* `--force`. Additive changes — a new table, a new column —
 * apply on their own and the deploy continues. Anything drizzle-kit considers
 * destructive fails the build instead, which is the correct outcome for a
 * command running unattended against a database holding real orders: a rename
 * it guesses wrong truncates a column, and no deploy is worth that. Those get
 * done by hand, deliberately, by someone who has read the diff.
 *
 * A no-op where no database is configured, so previews and fresh clones build
 * exactly as before.
 */
import { spawnSync } from "node:child_process";

if (!process.env.TURSO_DATABASE_URL) {
  console.log("[db-sync] No TURSO_DATABASE_URL — skipping schema sync.");
  process.exit(0);
}

console.log("[db-sync] Applying schema changes…");
const result = spawnSync("npx", ["drizzle-kit", "push"], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  console.error(
    "\n[db-sync] Schema sync failed. If drizzle-kit reported a data-loss " +
      "statement, apply it by hand rather than adding --force here."
  );
  process.exit(result.status ?? 1);
}
