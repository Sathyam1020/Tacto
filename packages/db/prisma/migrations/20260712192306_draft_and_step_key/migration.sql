-- Step.key: a stable block identity carried across publishes.
-- Add nullable first, backfill existing rows, then enforce NOT NULL + uniqueness
-- so existing published guides are never left in an invalid state.
ALTER TABLE "step" ADD COLUMN "key" TEXT;
UPDATE "step" SET "key" = gen_random_uuid()::text WHERE "key" IS NULL;
ALTER TABLE "step" ALTER COLUMN "key" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "step_guideId_key_key" ON "step"("guideId", "key");

-- CreateTable: the private working draft (one versioned document per guide).
CREATE TABLE "guide_draft" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guide_draft_guideId_key" ON "guide_draft"("guideId");

-- AddForeignKey
ALTER TABLE "guide_draft" ADD CONSTRAINT "guide_draft_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
