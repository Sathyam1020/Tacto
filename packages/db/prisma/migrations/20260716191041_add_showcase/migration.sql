-- CreateEnum
CREATE TYPE "ShowcaseLayout" AS ENUM ('SECTION', 'CHECKLIST', 'GALLERY');

-- CreateEnum
CREATE TYPE "ShowcaseStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ShowcaseItemType" AS ENUM ('GUIDE', 'VIDEO', 'PDF', 'LINK', 'FORM');

-- CreateEnum
CREATE TYPE "ShowcaseEventType" AS ENUM ('VIEW', 'ITEM_OPEN', 'ITEM_COMPLETE', 'COMPLETE', 'CONTACT_CLICK');

-- CreateTable
CREATE TABLE "showcase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ShowcaseStatus" NOT NULL DEFAULT 'DRAFT',
    "listed" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "layout" "ShowcaseLayout" NOT NULL DEFAULT 'CHECKLIST',
    "autoplay" BOOLEAN NOT NULL DEFAULT true,
    "brandColor" TEXT,
    "logoUrl" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "seo" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showcase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "showcase_section" (
    "id" TEXT NOT NULL,
    "showcaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showcase_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "showcase_item" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "type" "ShowcaseItemType" NOT NULL DEFAULT 'GUIDE',
    "guideId" TEXT,
    "title" TEXT,
    "url" TEXT,
    "formShareId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "showcase_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "showcase_event" (
    "id" TEXT NOT NULL,
    "showcaseId" TEXT NOT NULL,
    "type" "ShowcaseEventType" NOT NULL,
    "anonId" TEXT,
    "sessionId" TEXT,
    "target" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "showcase_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "showcase_slug_key" ON "showcase"("slug");

-- CreateIndex
CREATE INDEX "showcase_organizationId_idx" ON "showcase"("organizationId");

-- CreateIndex
CREATE INDEX "showcase_section_showcaseId_position_idx" ON "showcase_section"("showcaseId", "position");

-- CreateIndex
CREATE INDEX "showcase_item_sectionId_position_idx" ON "showcase_item"("sectionId", "position");

-- CreateIndex
CREATE INDEX "showcase_item_guideId_idx" ON "showcase_item"("guideId");

-- CreateIndex
CREATE INDEX "showcase_event_showcaseId_type_createdAt_idx" ON "showcase_event"("showcaseId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "showcase" ADD CONSTRAINT "showcase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showcase_section" ADD CONSTRAINT "showcase_section_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "showcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showcase_item" ADD CONSTRAINT "showcase_item_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "showcase_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showcase_item" ADD CONSTRAINT "showcase_item_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showcase_event" ADD CONSTRAINT "showcase_event_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "showcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
