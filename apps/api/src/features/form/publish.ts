import { parseFormDocument } from "@workspace/contracts/form";
import { Prisma, prisma } from "@workspace/db";
import { nanoid } from "nanoid";

import { AppError } from "../../middleware/error.js";

/**
 * Publish a form: copy the draft document onto the Form, bump `documentVersion`,
 * flip to PUBLISHED, mint a stable `shareId` on first publish, and drop the
 * draft (version-guarded, so edits that raced in survive as a fresh draft).
 * Ownership must be asserted by the caller. Mirrors guide `publishDraft`.
 */
export async function publishForm(formId: string): Promise<{
  shareId: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  documentVersion: number;
}> {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { shareId: true },
  });
  if (!form) throw new AppError(404, "NOT_FOUND", "Form not found");

  const draft = await prisma.formDraft.findUnique({
    where: { formId },
    select: { document: true, version: true },
  });
  if (!draft) throw new AppError(400, "NO_DRAFT", "Nothing to publish");
  const parsed = parseFormDocument(draft.document);
  if (!parsed.success) {
    throw new AppError(400, "INVALID_DRAFT", "The form draft is invalid");
  }
  const doc = parsed.data;

  return prisma.$transaction(async (tx) => {
    const result = await tx.form.update({
      where: { id: formId },
      data: {
        document: doc as unknown as Prisma.InputJsonValue,
        documentVersion: { increment: 1 },
        status: "PUBLISHED",
        publishedAt: new Date(),
        shareId: form.shareId ?? nanoid(12),
        // Keep the Form row's display fields in sync with the published doc.
        title: doc.title.trim() || "Untitled form",
        description: doc.description,
      },
      select: {
        shareId: true,
        status: true,
        publishedAt: true,
        documentVersion: true,
      },
    });
    await tx.formDraft.deleteMany({
      where: { formId, version: draft.version },
    });
    return result;
  });
}
