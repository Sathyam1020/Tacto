import "dotenv/config";

import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration. Environment variables are NOT auto-loaded in v7 —
 * the dotenv import above pulls in packages/db/.env for CLI commands
 * (generate / migrate / studio).
 *
 * Migrations must run over a DIRECT (non-pooled) connection: Prisma's migration
 * engine takes advisory locks that Neon's PgBouncer pooler doesn't support. So
 * prefer DIRECT_DATABASE_URL and fall back to DATABASE_URL (local dev / the
 * no-DB `prisma generate` step). We read process.env directly rather than
 * Prisma's env() helper because env() THROWS on a missing variable — which
 * breaks the fallback (`env(a) ?? env(b)` never reaches b) and the build-time
 * generate step that only has a throwaway DATABASE_URL.
 */
const datasourceUrl =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl,
  },
});
