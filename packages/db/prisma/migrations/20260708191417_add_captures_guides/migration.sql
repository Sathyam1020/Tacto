-- CreateEnum
CREATE TYPE "CaptureSource" AS ENUM ('EXTENSION', 'VIDEO_UPLOAD', 'IMPORT');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "GuideStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "capture" (
    "id" TEXT NOT NULL,
    "source" "CaptureSource" NOT NULL,
    "status" "CaptureStatus" NOT NULL DEFAULT 'UPLOADING',
    "title" TEXT,
    "events" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "capture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "GuideStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "captureId" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "guide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "elementLabel" TEXT,
    "url" TEXT,
    "screenshotUrl" TEXT,
    "boundingBox" JSONB,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "guideId" TEXT NOT NULL,

    CONSTRAINT "step_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capture_organizationId_status_idx" ON "capture"("organizationId", "status");

-- CreateIndex
CREATE INDEX "guide_organizationId_status_idx" ON "guide"("organizationId", "status");

-- CreateIndex
CREATE INDEX "step_guideId_position_idx" ON "step"("guideId", "position");

-- AddForeignKey
ALTER TABLE "capture" ADD CONSTRAINT "capture_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture" ADD CONSTRAINT "capture_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide" ADD CONSTRAINT "guide_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide" ADD CONSTRAINT "guide_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "capture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide" ADD CONSTRAINT "guide_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step" ADD CONSTRAINT "step_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
