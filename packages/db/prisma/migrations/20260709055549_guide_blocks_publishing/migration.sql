-- Blocks + publishing.

-- BlockType enum
CREATE TYPE "BlockType" AS ENUM ('STEP', 'HEADING', 'TIP', 'ALERT');

-- Guide: publishing fields
ALTER TABLE "guide" ADD COLUMN "shareId" TEXT;
ALTER TABLE "guide" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "guide" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "guide_shareId_key" ON "guide"("shareId");

-- Step: block type
ALTER TABLE "step" ADD COLUMN "type" "BlockType" NOT NULL DEFAULT 'STEP';

-- Step: instruction (markdown) -> content (HTML). Convert **bold** to <strong>
-- and wrap each existing instruction in a <p> so it renders as rich text.
ALTER TABLE "step" RENAME COLUMN "instruction" TO "content";
UPDATE "step"
SET "content" = '<p>' ||
  regexp_replace("content", '\*\*(.+?)\*\*', '<strong>\1</strong>', 'g')
  || '</p>';
