import { execSync } from "node:child_process";
import { closeDb, getDb, getPool } from "./postgres";

async function main() {
  const pool = await getPool();
  try {
    const res = await pool.query<{ version: string }>("SELECT version()");
    const version = res.rows[0]?.version || "";

    if (version.toLowerCase().includes("cockroachdb")) {
      // drizzle-kit's PostgreSQL catalog introspection is incompatible with CockroachDB;
      // getDb() / getPool() already executes idempotent DDL migrations for all schema tables.
      await getDb();
      console.log(
        "[turecode:db] CockroachDB detected — schema tables and columns synced via Drizzle DDL."
      );
      return;
    }
  } finally {
    await closeDb();
  }

  execSync("bunx drizzle-kit push", { stdio: "inherit" });
}

main().catch((err) => {
  console.error("[turecode:db] Push error:", err);
  process.exit(1);
});
