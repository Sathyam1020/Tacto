-- AlterTable
ALTER TABLE "capture" ADD COLUMN     "durationSec" DOUBLE PRECISION,
ADD COLUMN     "videoKey" TEXT,
ALTER COLUMN "events" DROP NOT NULL;
