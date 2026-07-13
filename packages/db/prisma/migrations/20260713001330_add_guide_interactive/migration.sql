-- Add the published Interactive (Walkthrough) tree. Additive + nullable:
-- existing guides read null and seed the tree from their blocks on demand.
ALTER TABLE "guide" ADD COLUMN "interactive" JSONB;
