import assert from "node:assert/strict";

import { DEFAULT_CUSTOMIZATION } from "@workspace/contracts/guide";
import { prisma } from "@workspace/db";

import { publishDraft } from "./publish-draft.js";

/**
 * Publish-draft regression (Phase 2): applying a draft to published content
 * reconciles blocks by stable `key` (preserving identity), deletes removed
 * blocks, creates new ones, and deletes the draft. Runs against the DATABASE
 * on a throwaway guide that is removed afterwards.
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
  console.log("publish-draft");

  const org = await prisma.organization.findFirst({ select: { id: true } });
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!org || !user) {
    console.log("  (skipped: no org/user to attach a throwaway guide to)");
    return;
  }

  let guideId: string | null = null;
  try {
    const guide = await prisma.guide.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        title: "PUBLISH-DRAFT TEST original",
        summary: "orig",
        status: "DRAFT",
        blocks: {
          create: [
            { key: "kA", type: "STEP", position: 1, content: "<p>A</p>" },
            { key: "kB", type: "STEP", position: 2, content: "<p>B</p>" },
          ],
        },
      },
      select: { id: true, blocks: { select: { id: true, key: true } } },
    });
    guideId = guide.id;
    const idA = guide.blocks.find((b) => b.key === "kA")!.id;
    const idB = guide.blocks.find((b) => b.key === "kB")!.id;

    // Draft: retitle, keep+edit kA, drop kB, add kC, reorder [kC, kA].
    await prisma.guideDraft.create({
      data: {
        guideId: guide.id,
        document: {
          v: 1,
          title: "PUBLISH-DRAFT TEST published",
          summary: "new",
          blocks: [
            block("kC", "<p>C</p>"),
            block("kA", "<p>A2</p>"),
          ],
          customization: DEFAULT_CUSTOMIZATION,
        },
      },
    });

    await publishDraft(guide.id);

    await test("guide content is updated from the draft", async () => {
      const g = await prisma.guide.findUnique({
        where: { id: guide.id },
        select: { title: true, summary: true },
      });
      assert.equal(g?.title, "PUBLISH-DRAFT TEST published");
      assert.equal(g?.summary, "new");
    });

    await test("interactive presentation is written (steps NOT duplicated)", async () => {
      const g = await prisma.guide.findUnique({
        where: { id: guide.id },
        select: { interactive: true },
      });
      const pres = g?.interactive as {
        slides?: unknown[];
        stepPresentation?: Record<string, unknown>;
      } | null;
      // v3: a presentation (slides + per-step overrides) — no duplicated steps.
      assert.ok(pres, "Guide.interactive was populated");
      assert.deepEqual(pres!.slides, []); // this draft has no slides
      assert.deepEqual(pres!.stepPresentation, {});
      // Steps live only on the Step rows, never inside the presentation.
      assert.equal("items" in (pres as object), false);
    });

    await test("blocks reconcile by key (identity preserved, reorder applied)", async () => {
      const steps = await prisma.step.findMany({
        where: { guideId: guide.id },
        orderBy: { position: "asc" },
        select: { id: true, key: true, content: true },
      });
      assert.equal(steps.length, 2);
      // kC is new (position 1), kA kept its original id (position 2).
      assert.equal(steps[0]!.key, "kC");
      assert.equal(steps[1]!.key, "kA");
      assert.equal(steps[1]!.id, idA, "kA kept its id across publish");
      assert.match(steps[1]!.content, /A2/);
      // kB (dropped) and idB are gone.
      assert.equal(steps.some((s) => s.key === "kB"), false);
      assert.equal(steps.some((s) => s.id === idB), false);
    });

    await test("the draft is deleted after publish", async () => {
      const draft = await prisma.guideDraft.findUnique({
        where: { guideId: guide.id },
      });
      assert.equal(draft, null);
    });

    await test("re-publishing with no draft is a safe no-op", async () => {
      await publishDraft(guide.id); // must not throw
    });

    await test("faqs publish from the draft to the guide", async () => {
      const faqs = [
        {
          question: "What happens after publishing?",
          answer: "It goes live.",
          source: "user" as const,
        },
      ];
      await prisma.guideDraft.create({
        data: {
          guideId: guide.id,
          document: {
            v: 3,
            title: "PUBLISH-DRAFT TEST published",
            summary: "new",
            blocks: [],
            interactive: {},
            assets: [],
            customization: DEFAULT_CUSTOMIZATION,
            faqs,
          },
        },
      });
      await publishDraft(guide.id);
      const g = await prisma.guide.findUnique({
        where: { id: guide.id },
        select: { faqs: true },
      });
      assert.deepEqual(g?.faqs, faqs);
    });
  } finally {
    if (guideId) {
      await prisma.guide.delete({ where: { id: guideId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll publish-draft tests passed");
}

function block(key: string, content: string) {
  return {
    key,
    type: "STEP" as const,
    content,
    screenshotKey: null,
    elementLabel: null,
    url: null,
    clickRect: null,
    confidence: null,
  };
}

void main();
