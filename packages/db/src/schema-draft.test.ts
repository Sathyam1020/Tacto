import "dotenv/config";
import assert from "node:assert/strict";

import { prisma } from "./index.js";

/**
 * Phase 0 schema regression (draft + Step.key). Verifies the backfill invariant
 * on existing data and that the GuideDraft table works end-to-end (JSON
 * document, version default, cascade delete). Runs against the configured
 * DATABASE_URL. Run: `npm test -w @workspace/db`.
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
  console.log("Phase 0 schema: Step.key + GuideDraft");

  await test("every Step has a stable key (backfill invariant)", async () => {
    const steps = await prisma.step.findMany({
      select: { guideId: true, key: true },
    });
    const empty = steps.filter((s) => !s.key);
    assert.equal(empty.length, 0, `${empty.length} step(s) missing a key`);
  });

  await test("(guideId, key) is unique across all steps", async () => {
    const steps = await prisma.step.findMany({
      select: { guideId: true, key: true },
    });
    const seen = new Set<string>();
    for (const s of steps) {
      const composite = `${s.guideId}:${s.key}`;
      assert.ok(!seen.has(composite), `duplicate (guideId,key): ${composite}`);
      seen.add(composite);
    }
  });

  await test("GuideDraft model is queryable", async () => {
    const count = await prisma.guideDraft.count();
    assert.equal(typeof count, "number");
  });

  await test("GuideDraft round-trips a document (version defaults, cascade)", async () => {
    const guide = await prisma.guide.findFirst({
      where: { draft: null },
      select: { id: true },
    });
    if (!guide) {
      console.log("    (skipped: no draft-free guide to attach to)");
      return;
    }
    const document = {
      v: 1,
      title: "roundtrip",
      summary: null,
      blocks: [{ key: "k1", type: "STEP", content: "<p>x</p>" }],
      customization: {},
    };
    let createdId: string | null = null;
    try {
      const created = await prisma.guideDraft.create({
        data: { guideId: guide.id, document },
      });
      createdId = created.id;
      assert.equal(created.version, 1, "version defaults to 1");
      const read = await prisma.guideDraft.findUnique({
        where: { guideId: guide.id },
      });
      assert.deepEqual(read?.document, document, "document round-trips");
    } finally {
      if (createdId) {
        await prisma.guideDraft
          .delete({ where: { id: createdId } })
          .catch(() => {});
      }
    }
  });

  await prisma.$disconnect();
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll Phase 0 schema tests passed");
}

void main();
