import "dotenv/config";

import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration. Environment variables are NOT auto-loaded in v7 —
 * the dotenv import above pulls in packages/db/.env for CLI commands
 * (generate / migrate / studio).
 */
// DIRECT_DATABASE_URL should point to Neon's direct (non-pooled) endpoint.
// The Prisma migration engine does not work over PgBouncer/pooler connections.
// Falls back to DATABASE_URL if DIRECT_DATABASE_URL is not set.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_DATABASE_URL") ?? env("DATABASE_URL"),
  },
});
