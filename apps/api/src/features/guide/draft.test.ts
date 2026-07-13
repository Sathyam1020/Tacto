import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";

import {
  buildInteractiveSequence,
  collectPresentationStrings,
  computeTranslationStaleness,
  DEFAULT_CUSTOMIZATION,
  guideTranslationAiSchema,
  interactivePresentationSchema,
  migrateDraftDocument,
  migrateDraftV2ToV3,
  migrateInteractiveV2ToPresentation,
  parseDraftDocument,
  readTranslationSteps,
  retranslateTargetSchema,
  swapAssetKey,
  translateStringsAiSchema,
  type DraftDocumentV2,
  type TranslationSource,
} from "@workspace/contracts/guide";
import { prisma } from "@workspace/db";

import { buildDraftDocument, serializeInteractive } from "./serialize.js";

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

  await test("buildDraftDocument (v2) maps blocks + seeds interactive + assets", async () => {
    const doc = buildDraftDocument({
      title: "T",
      summary: null,
      customization: null,
      interactive: null, // no published interactive → seed from blocks
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
    assert.equal(doc.v, 3);
    assert.equal(doc.title, "T");
    assert.equal(doc.blocks.length, 1);
    assert.equal(doc.blocks[0]!.key, "k1");
    assert.equal(doc.blocks[0]!.screenshotKey, "media/x.png");
    assert.equal(doc.blocks[0]!.assetId, "a_k1");
    assert.deepEqual(doc.blocks[0]!.clickRect, { x: 0, y: 0, w: 1, h: 1 });
    assert.equal(doc.customization.brand.color, "#5e6ad2"); // resolved default
    // No interactive data → an empty presentation (no duplicated steps).
    assert.deepEqual(doc.interactive.slides, []);
    assert.deepEqual(doc.interactive.stepPresentation, {});
    // Asset registry from the Steps (one screenshot → one asset).
    assert.equal(doc.assets.length, 1);
    assert.deepEqual(doc.assets[0], { id: "a_k1", key: "media/x.png" });
  });

  await test("buildDraftDocument (v3): step text GLOBAL (blocks); legacy slides migrated", async () => {
    // A legacy v2 tree with an intro slide + a step whose text diverged from the
    // List block. Under the merged model the List block is canonical; the slide
    // becomes an anchored presentation slide.
    const interactive = {
      items: [
        { kind: "intro", key: "s1", title: "Welcome", subtitle: "", buttons: [] },
        { kind: "step", key: "k1", content: "<p>edited in interactive</p>" },
      ],
    };
    const doc = buildDraftDocument({
      title: "T",
      summary: null,
      customization: null,
      interactive,
      blocks: [
        {
          key: "k1",
          type: "STEP",
          content: "<p>list copy</p>",
          elementLabel: null,
          url: null,
          screenshotUrl: null,
          clickRect: null,
          confidence: null,
        },
      ],
    });
    // The intro slide survives as a presentation slide (anchored at start).
    assert.equal(doc.interactive.slides.length, 1);
    assert.equal(doc.interactive.slides[0]!.kind, "intro");
    assert.deepEqual(doc.interactive.slides[0]!.anchor, { kind: "start" });
    // Step text lives on the block, unchanged (List is canonical).
    assert.equal(doc.blocks[0]!.content, "<p>list copy</p>");
  });

  await test("migrate-on-read: v1 draft → v3 (empty presentation + assets)", async () => {
    const v1 = {
      v: 1,
      title: "Old",
      summary: null,
      customization: DEFAULT_CUSTOMIZATION,
      blocks: [
        {
          key: "k1",
          type: "STEP",
          content: "<p>a</p>",
          screenshotKey: "media/x.png",
          elementLabel: null,
          url: null,
          clickRect: null,
          confidence: null,
        },
      ],
    };
    const parsed = parseDraftDocument(v1);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.v, 3);
    // v1 had no slides → empty presentation; assets from the block.
    assert.deepEqual(parsed.data.interactive.slides, []);
    assert.equal(parsed.data.blocks[0]!.assetId, "a_k1");
    assert.deepEqual(parsed.data.assets[0], { id: "a_k1", key: "media/x.png" });
    // Idempotent: migrating the migrated (v3) doc is a fixed point.
    assert.equal(
      isDeepStrictEqual(parsed.data, migrateDraftDocument(parsed.data)),
      true
    );
  });

  await test("serializeInteractive: no interactive → empty presentation", async () => {
    const pres = serializeInteractive(null);
    assert.deepEqual(pres.slides, []);
    assert.deepEqual(pres.stepPresentation, {});
  });

  await test("serializeInteractive: legacy v2 tree → presentation (slide anchored)", async () => {
    const stored = {
      items: [
        { kind: "step", key: "k1", content: "<p>a</p>", screenshotKey: null },
        { kind: "intro", key: "s1", title: "Hi", subtitle: "", buttons: [] },
      ],
    };
    const pres = serializeInteractive(stored);
    assert.equal(pres.slides.length, 1);
    assert.equal(pres.slides[0]!.kind, "intro");
    assert.deepEqual(pres.slides[0]!.anchor, { kind: "afterStep", stepKey: "k1" });
  });

  await test("swapAssetKey (v3): an image edit swaps the block + registry", async () => {
    const base = migrateDraftDocument({
      v: 1,
      title: "T",
      summary: null,
      customization: DEFAULT_CUSTOMIZATION,
      blocks: [
        {
          key: "k1",
          type: "STEP",
          content: "<p>a</p>",
          screenshotKey: "media/old.png",
          assetId: null,
          elementLabel: null,
          url: null,
          clickRect: null,
          confidence: null,
        },
      ],
    });
    assert.equal(base.blocks[0]!.assetId, "a_k1");
    const swapped = swapAssetKey(base, "a_k1", "media/new.png");
    assert.equal(swapped.blocks[0]!.screenshotKey, "media/new.png");
    assert.deepEqual(swapped.assets[0], { id: "a_k1", key: "media/new.png" });
    // A different asset id is untouched.
    const noop = swapAssetKey(base, "a_other", "media/x.png");
    assert.equal(noop.blocks[0]!.screenshotKey, "media/old.png");
  });

  await test("buildInteractiveSequence: interleaves slides by anchor, orphans dangling", async () => {
    const steps = [{ key: "k1" }, { key: "k2" }];
    const pres = interactivePresentationSchema.parse({
      slides: [
        { kind: "intro", key: "s0", anchor: { kind: "start" } },
        { kind: "chapter", key: "s2", anchor: { kind: "afterStep", stepKey: "k1" } },
        { kind: "chapter", key: "sX", anchor: { kind: "afterStep", stepKey: "gone" } },
      ],
      stepPresentation: {},
    });
    const { sequence, orphaned } = buildInteractiveSequence(steps, pres);
    assert.deepEqual(
      sequence.map((f) =>
        f.kind === "step" ? `step:${f.step.key}` : `slide:${f.slide.key}`
      ),
      ["slide:s0", "step:k1", "slide:s2", "step:k2"]
    );
    // Dangling anchor is surfaced, never silently placed.
    assert.equal(orphaned.length, 1);
    assert.equal(orphaned[0]!.key, "sX");
  });

  await test("migrate v2→v3: slides anchored to preceding step; callout colors → presentation", async () => {
    const items = [
      {
        kind: "step" as const,
        key: "k1",
        content: "<p>a</p>",
        screenshotKey: null,
        assetId: null,
        clickRect: null,
        confidence: null,
        calloutBg: "#111",
        calloutText: "#fff",
      },
      {
        kind: "intro" as const,
        key: "s1",
        title: "Hi",
        subtitle: "",
        appearance: {
          background: { kind: "none" as const, value: null },
          theme: "light" as const,
          align: "center" as const,
          buttonColumns: 1 as const,
        },
        buttons: [],
      },
    ];
    const pres = migrateInteractiveV2ToPresentation(items);
    assert.equal(pres.slides.length, 1);
    assert.deepEqual(pres.slides[0]!.anchor, { kind: "afterStep", stepKey: "k1" });
    assert.deepEqual(pres.stepPresentation["k1"]!.appearance, {
      calloutBackground: "#111",
      calloutText: "#fff",
    });

    // Draft-level migration + the blank-block nicety: a blank List block whose
    // interactive twin had text gets the text copied over (List otherwise wins).
    const v2 = {
      v: 2 as const,
      title: "T",
      summary: null,
      customization: DEFAULT_CUSTOMIZATION,
      assets: [],
      blocks: [
        { key: "k1", type: "STEP" as const, content: "", screenshotKey: null, assetId: null, elementLabel: null, url: null, clickRect: null, confidence: null },
      ],
      interactive: {
        items: [
          { kind: "step" as const, key: "k1", content: "<p>rescued</p>", screenshotKey: null, assetId: null, clickRect: null, confidence: null, calloutBg: null, calloutText: null },
        ],
      },
    };
    const v3 = migrateDraftV2ToV3(v2 as unknown as DraftDocumentV2);
    assert.equal(v3.v, 3);
    assert.equal(v3.blocks[0]!.content, "<p>rescued</p>");
    assert.equal(v3.interactive.slides.length, 0);
  });

  await test("guideTranslationAiSchema: every field REQUIRED (OpenAI strict)", async () => {
    // OpenAI structured-output (strict) rejects a schema whose properties are
    // not all in `required`. A `.default()`/`.optional()` field breaks it — this
    // exact bug erroed every translation. Guard against re-introducing it.
    const shape = guideTranslationAiSchema.shape as Record<
      string,
      { safeParse: (v: unknown) => { success: boolean } }
    >;
    for (const key of Object.keys(shape)) {
      assert.equal(
        shape[key]!.safeParse(undefined).success,
        false,
        `field "${key}" must be required (no default/optional)`
      );
    }
  });

  await test("readTranslationSteps: record passthrough + legacy index→key", async () => {
    // v3 record form is returned as-is.
    assert.deepEqual(
      readTranslationSteps({ k1: "uno", k2: "dos" }, ["k1", "k2"]),
      { k1: "uno", k2: "dos" }
    );
    // Legacy [{ index, content }] is mapped to keys via current block order.
    assert.deepEqual(
      readTranslationSteps(
        [
          { index: 0, content: "uno" },
          { index: 1, content: "dos" },
        ],
        ["k1", "k2"]
      ),
      { k1: "uno", k2: "dos" }
    );
    // An index with no matching block (guide shrank) is dropped, not crashed.
    assert.deepEqual(
      readTranslationSteps([{ index: 5, content: "x" }], ["k1"]),
      {}
    );
    // Garbage → empty map.
    assert.deepEqual(readTranslationSteps(null, ["k1"]), {});
  });

  await test("collectPresentationStrings: slide title/subtitle/buttons by id", async () => {
    const pres = interactivePresentationSchema.parse({
      slides: [
        {
          kind: "intro",
          key: "s1",
          title: "Welcome",
          subtitle: "Tour",
          appearance: {
            background: { kind: "none", value: null },
            theme: "light",
            align: "center",
            buttonColumns: 1,
          },
          buttons: [
            {
              key: "b1",
              text: "Start",
              destination: { kind: "next" },
              bgColor: "#000",
              textColor: "#fff",
            },
          ],
          anchor: { kind: "start" },
        },
      ],
      stepPresentation: {},
    });
    const strings = collectPresentationStrings(pres);
    assert.deepEqual(
      strings.map((s) => `${s.id}=${s.content}`).sort(),
      ["b1=Start", "s1#subtitle=Tour", "s1#title=Welcome"]
    );
  });

  await test("computeTranslationStaleness: null source → fresh; diffs flagged", async () => {
    const current = {
      title: "T",
      summary: "S",
      steps: { k1: "<p>a</p>", k2: "<p>b changed</p>", k3: "<p>new</p>" },
      slides: { "s1#title": "Hi" },
    };
    // Legacy row (no captured source) is treated as fresh — never cries wolf.
    assert.equal(computeTranslationStaleness(null, current).stale, false);

    const source: TranslationSource = {
      title: "T",
      summary: "S old",
      steps: { k1: "<p>a</p>", k2: "<p>b</p>", kGone: "<p>x</p>" },
      slides: { "s1#title": "Hi" },
    };
    const st = computeTranslationStaleness(source, current);
    assert.equal(st.stale, true);
    assert.equal(st.summaryStale, true);
    assert.equal(st.titleStale, false);
    assert.deepEqual(st.staleStepKeys, ["k2"]); // content changed
    assert.deepEqual(st.newStepKeys, ["k3"]); // added since
    assert.deepEqual(st.removedStepKeys, ["kGone"]); // dropped since
    assert.deepEqual(st.staleSlideKeys, []); // slide unchanged
  });

  await test("retranslateTargetSchema: title / summary / step(stepKey)", async () => {
    assert.equal(
      retranslateTargetSchema.safeParse({ target: { kind: "title" } }).success,
      true
    );
    assert.equal(
      retranslateTargetSchema.safeParse({ target: { kind: "summary" } }).success,
      true
    );
    assert.equal(
      retranslateTargetSchema.safeParse({
        target: { kind: "step", stepKey: "k1" },
      }).success,
      true
    );
    // A step target without a key, or an unknown kind, is rejected.
    assert.equal(
      retranslateTargetSchema.safeParse({ target: { kind: "step" } }).success,
      false
    );
    assert.equal(
      retranslateTargetSchema.safeParse({ target: { kind: "block" } }).success,
      false
    );
  });

  await test("translateStringsAiSchema: every field REQUIRED (OpenAI strict)", async () => {
    // Same strict-schema guard as the guide translator: an optional field breaks
    // OpenAI structured output. The per-step re-translate depends on this schema.
    const inner = translateStringsAiSchema.shape.strings.element.shape as Record<
      string,
      { isOptional: () => boolean }
    >;
    for (const [name, field] of Object.entries(inner)) {
      assert.equal(field.isOptional(), false, `${name} must be required`);
    }
  });

  await test("isDirty: identical → clean, changed → dirty", async () => {
    const guide = {
      title: "T",
      summary: null,
      customization: null,
      interactive: null,
      blocks: [],
    };
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
