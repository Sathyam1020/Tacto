/**
 * One-time backfill: ensure every workspace has a default folder, and move any
 * folderless guides into it. Safe to re-run (idempotent).
 *
 * Usage (from apps/api): node --env-file=.env --import tsx scripts/backfill-folders.ts
 */
import { ensureDefaultFolder, prisma } from "@workspace/db";

const orgs = await prisma.organization.findMany({ select: { id: true } });
let moved = 0;
for (const org of orgs) {
  const defaultId = await ensureDefaultFolder(prisma, org.id);
  const res = await prisma.guide.updateMany({
    where: { organizationId: org.id, folderId: null },
    data: { folderId: defaultId },
  });
  moved += res.count;
}
console.log(
  `Ensured a default folder for ${orgs.length} workspace(s); moved ${moved} folderless guide(s).`
);
await prisma.$disconnect();
