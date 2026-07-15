import { PrismaPg } from "@prisma/adapter-pg";

import { type FolderKind, Prisma, PrismaClient } from "./generated/client.js";

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

/**
 * Every guide/form belongs to a folder. Each workspace has exactly one default
 * folder ("General") per kind that new/uncategorized items land in and that
 * can't be deleted. Guide and Form folders are independent namespaces (`kind`).
 * These helpers accept a tx client too (prisma is assignable).
 */
export async function ensureDefaultFolder(
  client: Prisma.TransactionClient,
  organizationId: string,
  kind: FolderKind = "GUIDE"
): Promise<string> {
  const existing = await client.folder.findFirst({
    where: { organizationId, kind, isDefault: true },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await client.folder.create({
    data: { name: "General", organizationId, kind, isDefault: true, position: 0 },
    select: { id: true },
  });
  return created.id;
}

export async function getDefaultFolderId(
  client: Prisma.TransactionClient,
  organizationId: string,
  kind: FolderKind = "GUIDE"
): Promise<string | null> {
  const folder = await client.folder.findFirst({
    where: { organizationId, kind, isDefault: true },
    select: { id: true },
  });
  return folder?.id ?? null;
}
