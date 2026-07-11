-- CreateTable
CREATE TABLE "capture_intent" (
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capture_intent_pkey" PRIMARY KEY ("userId","organizationId")
);
