-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "form" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "shareId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "pinnedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "document" JSONB,
    "documentVersion" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "startCount" INTEGER NOT NULL DEFAULT 0,
    "submitCount" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "folderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_draft" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "anonId" TEXT,
    "answers" JSONB NOT NULL,
    "formVersion" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "form_shareId_key" ON "form"("shareId");

-- CreateIndex
CREATE INDEX "form_organizationId_status_idx" ON "form"("organizationId", "status");

-- CreateIndex
CREATE INDEX "form_organizationId_folderId_idx" ON "form"("organizationId", "folderId");

-- CreateIndex
CREATE UNIQUE INDEX "form_draft_formId_key" ON "form_draft"("formId");

-- CreateIndex
CREATE INDEX "form_submission_formId_createdAt_idx" ON "form_submission"("formId", "createdAt");

-- AddForeignKey
ALTER TABLE "form" ADD CONSTRAINT "form_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form" ADD CONSTRAINT "form_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form" ADD CONSTRAINT "form_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_draft" ADD CONSTRAINT "form_draft_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
