-- AlterTable
ALTER TABLE "guide_translation" ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ready';

-- AlterTable
ALTER TABLE "narration" ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ready';
