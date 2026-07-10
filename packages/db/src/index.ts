import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client.js";

/**
 * Prisma client singleton.
 *
 * The consumer (apps/api) is responsible for loading environment variables
 * before importing this module — this package stays side-effect free.
 *
 * globalThis caching prevents connection-pool exhaustion when the dev
 * process hot-reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Load your environment (e.g. dotenv) before importing @workspace/db."
    );
  }
  // Larger pool so concurrent polling + worker transactions don't starve
  // each other on Neon's pooler.
  const adapter = new PrismaPg({ connectionString, max: 20 });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/* Re-export generated model types (User, Session, …) for consumers. */
export * from "./generated/client.js";
