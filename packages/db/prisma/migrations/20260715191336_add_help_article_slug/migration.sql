-- help_article gains a stable, human public slug (unique per collection).
-- The table is newly created and empty, so a required column without a default
-- is safe here (no existing rows to backfill).

-- AlterTable
ALTER TABLE "help_article" ADD COLUMN "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "help_article_collectionId_slug_key" ON "help_article"("collectionId", "slug");
