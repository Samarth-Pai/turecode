import os from "node:os";
import { defineConfig } from "drizzle-kit";

const pgPort = process.env.PG_LOCAL_PORT || "5433";
const pgUser = process.env.PG_LOCAL_USER || os.userInfo().username || "postgres";
const pgDb = process.env.PG_LOCAL_DB || "turecode";

const url =
  process.env.DATABASE_URL ||
  `postgresql://${encodeURIComponent(pgUser)}@127.0.0.1:${pgPort}/${encodeURIComponent(pgDb)}`;

export default defineConfig({
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
