-- AlterTable
ALTER TABLE "guide" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "folder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "folder_organizationId_idx" ON "folder"("organizationId");

-- CreateIndex
CREATE INDEX "guide_organizationId_folderId_idx" ON "guide"("organizationId", "folderId");

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "folder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide" ADD CONSTRAINT "guide_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
