/**
 * One-time backfill: ensure every workspace has a FORM default folder, and move
 * any folderless forms into it. Needed after the folder-kind migration nulled
 * forms that used to live in shared (now Guide-kind) folders. Idempotent.
 *
 * Usage (from apps/api): node --env-file=.env --import tsx scripts/backfill-form-folders.ts
 */
import { ensureDefaultFolder, prisma } from "@workspace/db";

const orgs = await prisma.organization.findMany({ select: { id: true } });
let moved = 0;
for (const org of orgs) {
  const defaultId = await ensureDefaultFolder(prisma, org.id, "FORM");
  const res = await prisma.form.updateMany({
    where: { organizationId: org.id, folderId: null, deletedAt: null },
    data: { folderId: defaultId },
  });
  moved += res.count;
}
console.log(
  `Ensured a FORM default folder for ${orgs.length} workspace(s); moved ${moved} folderless form(s).`
);
await prisma.$disconnect();
