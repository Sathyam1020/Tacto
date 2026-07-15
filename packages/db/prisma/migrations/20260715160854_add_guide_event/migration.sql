-- CreateEnum
CREATE TYPE "GuideEventType" AS ENUM ('VIEW', 'WALKTHROUGH_START', 'WALKTHROUGH_STEP', 'COMPLETE', 'PDF_DOWNLOAD', 'LANGUAGE_SWITCH', 'MODE_SWITCH', 'EMBED_OPEN', 'EMBED_SUBMIT', 'SESSION_END');

-- CreateTable
CREATE TABLE "guide_event" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "type" "GuideEventType" NOT NULL,
    "anonId" TEXT,
    "sessionId" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guide_event_guideId_createdAt_idx" ON "guide_event"("guideId", "createdAt");

-- CreateIndex
CREATE INDEX "guide_event_guideId_type_createdAt_idx" ON "guide_event"("guideId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "guide_event" ADD CONSTRAINT "guide_event_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
