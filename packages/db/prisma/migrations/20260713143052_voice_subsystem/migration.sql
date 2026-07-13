-- CreateTable
CREATE TABLE "narration" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "narration_segment" (
    "id" TEXT NOT NULL,
    "narrationId" TEXT NOT NULL,
    "anchorKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "markup" JSONB,
    "humanEdited" BOOLEAN NOT NULL DEFAULT false,
    "sourceFingerprint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narration_segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_render" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "renderHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "voiceId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "speed" DOUBLE PRECISION,
    "params" JSONB,
    "language" TEXT,
    "r2Key" TEXT,
    "durationMs" INTEGER,
    "sizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_render_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segment_render_ref" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "renderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "segment_render_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "narration_guideId_language_key" ON "narration"("guideId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "narration_segment_narrationId_anchorKey_key" ON "narration_segment"("narrationId", "anchorKey");

-- CreateIndex
CREATE INDEX "media_render_guideId_status_idx" ON "media_render"("guideId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_render_guideId_renderHash_key" ON "media_render"("guideId", "renderHash");

-- CreateIndex
CREATE UNIQUE INDEX "segment_render_ref_segmentId_kind_key" ON "segment_render_ref"("segmentId", "kind");

-- AddForeignKey
ALTER TABLE "narration" ADD CONSTRAINT "narration_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narration_segment" ADD CONSTRAINT "narration_segment_narrationId_fkey" FOREIGN KEY ("narrationId") REFERENCES "narration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_render" ADD CONSTRAINT "media_render_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_render_ref" ADD CONSTRAINT "segment_render_ref_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "narration_segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_render_ref" ADD CONSTRAINT "segment_render_ref_renderId_fkey" FOREIGN KEY ("renderId") REFERENCES "media_render"("id") ON DELETE CASCADE ON UPDATE CASCADE;
