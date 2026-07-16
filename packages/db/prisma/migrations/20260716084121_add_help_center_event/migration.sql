-- CreateEnum
CREATE TYPE "HelpCenterEventType" AS ENUM ('VIEW', 'SEARCH', 'COLLECTION_OPEN', 'CONTACT_CLICK');

-- CreateTable
CREATE TABLE "help_center_event" (
    "id" TEXT NOT NULL,
    "helpCenterId" TEXT NOT NULL,
    "type" "HelpCenterEventType" NOT NULL,
    "anonId" TEXT,
    "sessionId" TEXT,
    "target" TEXT,
    "zeroResults" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_center_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "help_center_event_helpCenterId_type_createdAt_idx" ON "help_center_event"("helpCenterId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "help_center_event" ADD CONSTRAINT "help_center_event_helpCenterId_fkey" FOREIGN KEY ("helpCenterId") REFERENCES "help_center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
