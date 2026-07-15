-- CreateEnum
CREATE TYPE "HelpCenterStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "help_center" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "HelpCenterStatus" NOT NULL DEFAULT 'DRAFT',
    "listed" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "faviconUrl" TEXT,
    "heroTitle" TEXT NOT NULL DEFAULT 'How can we help you?',
    "heroSubtitle" TEXT,
    "navLinks" JSONB,
    "footerLinks" JSONB,
    "contactFormId" TEXT,
    "statusUrl" TEXT,
    "seo" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_collection" (
    "id" TEXT NOT NULL,
    "helpCenterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_article" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "titleOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "help_center_organizationId_key" ON "help_center"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "help_center_slug_key" ON "help_center"("slug");

-- CreateIndex
CREATE INDEX "help_collection_helpCenterId_position_idx" ON "help_collection"("helpCenterId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "help_collection_helpCenterId_slug_key" ON "help_collection"("helpCenterId", "slug");

-- CreateIndex
CREATE INDEX "help_article_collectionId_position_idx" ON "help_article"("collectionId", "position");

-- CreateIndex
CREATE INDEX "help_article_guideId_idx" ON "help_article"("guideId");

-- CreateIndex
CREATE UNIQUE INDEX "help_article_collectionId_guideId_key" ON "help_article"("collectionId", "guideId");

-- AddForeignKey
ALTER TABLE "help_center" ADD CONSTRAINT "help_center_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_collection" ADD CONSTRAINT "help_collection_helpCenterId_fkey" FOREIGN KEY ("helpCenterId") REFERENCES "help_center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_article" ADD CONSTRAINT "help_article_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "help_collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_article" ADD CONSTRAINT "help_article_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
