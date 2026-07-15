import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";

import {
  emptyFormDocument,
  readFormDocument,
  validateSubmission,
} from "@workspace/contracts/form";
import { ensureDefaultFolder, prisma } from "@workspace/db";

import { publishForm } from "./publish.js";
import { buildFormDraft } from "./serialize.js";

/**
 * Form lifecycle (Phase 2) — CRUD + draft/publish against the DATABASE on a
 * throwaway form removed afterwards. Run: `npm test -w api`.
 */

let failures = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.message : err);
  }
}

async function main() {
  console.log("form lifecycle");

  const org = await prisma.organization.findFirst({ select: { id: true } });
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!org || !user) {
    console.log("  (skipped: no org/user to attach a throwaway form to)");
    return;
  }

  await test("buildFormDraft: fresh form matches the empty seed (not dirty)", () => {
    const seed = emptyFormDocument("T", null);
    const built = buildFormDraft({ title: "T", description: null, document: null });
    assert.equal(isDeepStrictEqual(built, seed), true);
  });

  let formId: string | null = null;
  try {
    const defaultFolder = await ensureDefaultFolder(prisma, org.id, "FORM");
    const form = await prisma.form.create({
      data: {
        title: "LIFECYCLE TEST",
        description: null,
        status: "DRAFT",
        organizationId: org.id,
        createdById: user.id,
        folderId: defaultFolder,
        draft: {
          create: {
            document: emptyFormDocument("LIFECYCLE TEST", null) as never,
            updatedByUserId: user.id,
          },
        },
      },
      select: { id: true, folderId: true, documentVersion: true },
    });
    formId = form.id;

    await test("created form lands in the default folder, version 0", () => {
      assert.equal(form.folderId, defaultFolder);
      assert.equal(form.documentVersion, 0);
    });

    await test("draft autosave is optimistic-concurrent (version guard)", async () => {
      const draft = await prisma.formDraft.findUnique({
        where: { formId: form.id },
        select: { version: true },
      });
      const base = draft!.version;
      const doc = {
        v: 1,
        title: "Edited",
        description: null,
        fields: [{ key: "q1", type: "short_text", title: "Name" }],
        thankYou: { title: "Thanks", description: "" },
        design: {},
        settings: {},
      };
      // Stale base version → no update.
      const stale = await prisma.formDraft.updateMany({
        where: { formId: form.id, version: base - 1 },
        data: { document: doc as never, version: { increment: 1 } },
      });
      assert.equal(stale.count, 0);
      // Correct base version → applied.
      const ok = await prisma.formDraft.updateMany({
        where: { formId: form.id, version: base },
        data: { document: doc as never, version: { increment: 1 } },
      });
      assert.equal(ok.count, 1);
    });

    await test("publish: copies doc, bumps documentVersion, mints shareId, drops draft", async () => {
      const r1 = await publishForm(form.id);
      assert.equal(r1.status, "PUBLISHED");
      assert.equal(r1.documentVersion, 1); // 0 → 1
      assert.ok(r1.shareId && r1.shareId.length >= 8);

      const published = await prisma.form.findUnique({
        where: { id: form.id },
        select: { title: true, document: true },
      });
      assert.equal(published!.title, "Edited"); // synced from the doc
      assert.equal((published!.document as { fields: unknown[] }).fields.length, 1);

      const draftGone = await prisma.formDraft.findUnique({
        where: { formId: form.id },
      });
      assert.equal(draftGone, null);

      // Re-publish keeps shareId stable and increments the version again.
      await prisma.formDraft.create({
        data: {
          formId: form.id,
          document: emptyFormDocument("Edited", null) as never,
          updatedByUserId: user.id,
        },
      });
      const r2 = await publishForm(form.id);
      assert.equal(r2.shareId, r1.shareId);
      assert.equal(r2.documentVersion, 2);
    });

    await test("submission validates + records formVersion + counts", async () => {
      const published = await prisma.form.findUnique({
        where: { id: form.id },
        select: { document: true, documentVersion: true },
      });
      const doc = readFormDocument(published!.document)!;
      const answers = { q1: "Sam" };
      assert.equal(validateSubmission(doc.fields, answers).length, 0);

      await prisma.formSubmission.create({
        data: { formId: form.id, answers, formVersion: published!.documentVersion },
      });
      await prisma.form.update({
        where: { id: form.id },
        data: { submitCount: { increment: 1 } },
      });

      const sub = await prisma.formSubmission.findFirst({
        where: { formId: form.id },
        select: { formVersion: true },
      });
      assert.equal(sub!.formVersion, published!.documentVersion);
      const after = await prisma.form.findUnique({
        where: { id: form.id },
        select: { submitCount: true },
      });
      assert.equal(after!.submitCount, 1);
    });
  } finally {
    if (formId) await prisma.form.delete({ where: { id: formId } }).catch(() => {});
    await prisma.$disconnect();
  }

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll form lifecycle tests passed");
}

void main();
