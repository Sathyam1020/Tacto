-- AlterTable
ALTER TABLE "guide" ADD COLUMN     "customization" JSONB;

-- AlterTable
ALTER TABLE "step" ADD COLUMN     "settings" JSONB,
ADD COLUMN     "voiceoverUrl" TEXT;

-- CreateTable
CREATE TABLE "guide_translation" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_reaction" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_comment" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guide_translation_guideId_language_key" ON "guide_translation"("guideId", "language");

-- CreateIndex
CREATE INDEX "guide_reaction_guideId_idx" ON "guide_reaction"("guideId");

-- CreateIndex
CREATE UNIQUE INDEX "guide_reaction_guideId_anonId_emoji_key" ON "guide_reaction"("guideId", "anonId", "emoji");

-- CreateIndex
CREATE INDEX "guide_comment_guideId_createdAt_idx" ON "guide_comment"("guideId", "createdAt");

-- AddForeignKey
ALTER TABLE "guide_translation" ADD CONSTRAINT "guide_translation_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_reaction" ADD CONSTRAINT "guide_reaction_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_comment" ADD CONSTRAINT "guide_comment_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
