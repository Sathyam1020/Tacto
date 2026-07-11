-- AlterTable
ALTER TABLE "capture" ADD COLUMN     "folderId" TEXT;

-- AddForeignKey
ALTER TABLE "capture" ADD CONSTRAINT "capture_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
