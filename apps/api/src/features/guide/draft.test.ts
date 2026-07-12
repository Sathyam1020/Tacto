import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";

import { prisma } from "@workspace/db";

import { buildDraftDocument } from "./serialize.js";

/**
 * Draft backend regression (Phase 1): document building, the dirty check, and
 * the optimistic-concurrency guard the autosave relies on. The concurrency case
 * runs against the configured DATABASE_URL and cleans up after itself.
 * Run: `npm test -w api`.
 */

let failures = 0;
async function test(name: string, fn: () => Promise<void>) {
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
  console.log("guide draft");

  await test("buildDraftDocument maps blocks + resolves customization", async () => {
    const doc = buildDraftDocument({
      title: "T",
      summary: null,
      customization: null,
      blocks: [
        {
          key: "k1",
          type: "STEP",
          content: "<p>a</p>",
          elementLabel: null,
          url: null,
          screenshotUrl: "media/x.png", // column stores the key
          clickRect: { x: 0, y: 0, w: 1, h: 1 },
          confidence: 0.9,
        },
      ],
    });
    assert.equal(doc.v, 1);
    assert.equal(doc.title, "T");
    assert.equal(doc.blocks.length, 1);
    assert.equal(doc.blocks[0]!.key, "k1");
    assert.equal(doc.blocks[0]!.screenshotKey, "media/x.png");
    assert.deepEqual(doc.blocks[0]!.clickRect, { x: 0, y: 0, w: 1, h: 1 });
    assert.equal(doc.customization.brand.color, "#5e6ad2"); // resolved default
  });

  await test("isDirty: identical → clean, changed → dirty", async () => {
    const guide = { title: "T", summary: null, customization: null, blocks: [] };
    const a = buildDraftDocument(guide);
    assert.equal(isDeepStrictEqual(a, buildDraftDocument(guide)), true);
    assert.equal(isDeepStrictEqual(a, { ...a, title: "T2" }), false);
  });

  await test("draft autosave is optimistic-concurrent (version guard)", async () => {
    const guide = await prisma.guide.findFirst({
      where: { draft: null },
      select: { id: true },
    });
    if (!guide) {
      console.log("    (skipped: no draft-free guide)");
      return;
    }
    let draftId: string | null = null;
    try {
      const created = await prisma.guideDraft.create({
        data: {
          guideId: guide.id,
          document: { v: 1, title: "x", summary: null, blocks: [], customization: {} },
        },
        select: { id: true, version: true },
      });
      draftId = created.id;
      assert.equal(created.version, 1);

      // Correct base version → writes and increments.
      const ok = await prisma.guideDraft.updateMany({
        where: { guideId: guide.id, version: 1 },
        data: { version: { increment: 1 } },
      });
      assert.equal(ok.count, 1);

      // Stale base version → no write (this is the 409 path).
      const stale = await prisma.guideDraft.updateMany({
        where: { guideId: guide.id, version: 1 },
        data: { version: { increment: 1 } },
      });
      assert.equal(stale.count, 0);

      const current = await prisma.guideDraft.findUnique({
        where: { guideId: guide.id },
        select: { version: true },
      });
      assert.equal(current?.version, 2);
    } finally {
      if (draftId) {
        await prisma.guideDraft.delete({ where: { id: draftId } }).catch(() => {});
      }
    }
  });

  await prisma.$disconnect();
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll draft tests passed");
}

void main();
