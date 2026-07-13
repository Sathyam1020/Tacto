-- Interactive-tree translations (key → translated text). Additive + nullable.
ALTER TABLE "guide_translation" ADD COLUMN "interactive" JSONB;
