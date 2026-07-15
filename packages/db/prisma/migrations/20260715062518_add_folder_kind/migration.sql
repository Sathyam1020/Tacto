-- CreateEnum
CREATE TYPE "FolderKind" AS ENUM ('GUIDE', 'FORM');

-- AlterTable
ALTER TABLE "folder" ADD COLUMN     "kind" "FolderKind" NOT NULL DEFAULT 'GUIDE';

-- Existing folders were shared between Guides and Forms; they are all Guide
-- folders now (the default above). Any form that was filed under one of those
-- shared folders would otherwise point at a Guide-kind folder it can no longer
-- appear in — reset those to uncategorized so Forms start with a clean, own
-- folder namespace (the Form default folder is created lazily on first use).
UPDATE "form" SET "folderId" = NULL WHERE "folderId" IS NOT NULL;
