import "dotenv/config";

import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration. Environment variables are NOT auto-loaded in v7 —
 * the dotenv import above pulls in packages/db/.env for CLI commands
 * (generate / migrate / studio).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
