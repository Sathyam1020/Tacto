import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";

import {
  applyInteractiveTranslation,
  collectInteractiveStrings,
  DEFAULT_CUSTOMIZATION,
  migrateDraftDocument,
  parseDraftDocument,
  swapAssetKey,
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
    assert.equal(doc.v, 2);
    assert.equal(doc.title, "T");
    assert.equal(doc.blocks.length, 1);
    assert.equal(doc.blocks[0]!.key, "k1");
    assert.equal(doc.blocks[0]!.screenshotKey, "media/x.png");
    assert.equal(doc.blocks[0]!.assetId, "a_k1");
    assert.deepEqual(doc.blocks[0]!.clickRect, { x: 0, y: 0, w: 1, h: 1 });
    assert.equal(doc.customization.brand.color, "#5e6ad2"); // resolved default
    // Interactive seeded 1:1 from the block, sharing key + asset.
    assert.equal(doc.interactive.items.length, 1);
    const it = doc.interactive.items[0]!;
    assert.equal(it.kind, "step");
    assert.equal(it.key, "k1");
    assert.equal(it.kind === "step" && it.assetId, "a_k1");
    // Shared asset registry (one screenshot → one asset).
    assert.equal(doc.assets.length, 1);
    assert.deepEqual(doc.assets[0], { id: "a_k1", key: "media/x.png" });
  });

  await test("published interactive tree is preserved (independent of blocks)", async () => {
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
    // Interactive is taken as-is, NOT reseeded from blocks.
    assert.equal(doc.interactive.items.length, 2);
    assert.equal(doc.interactive.items[0]!.kind, "intro");
    const step = doc.interactive.items[1]!;
    assert.equal(step.kind === "step" && step.content, "<p>edited in interactive</p>");
  });

  await test("migrate-on-read: v1 draft → v2 (seeds interactive + assets)", async () => {
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
    assert.equal(parsed.data.v, 2);
    assert.equal(parsed.data.interactive.items.length, 1);
    assert.equal(parsed.data.blocks[0]!.assetId, "a_k1");
    assert.deepEqual(parsed.data.assets[0], { id: "a_k1", key: "media/x.png" });
    // Idempotent: migrating the migrated doc is a fixed point.
    assert.equal(
      isDeepStrictEqual(parsed.data, migrateDraftDocument(parsed.data)),
      true
    );
  });

  await test("serializeInteractive: null tree seeds 1:1 from blocks", async () => {
    const tree = await serializeInteractive(null, [
      { key: "k1", content: "<p>a</p>", screenshotUrl: null, clickRect: null, confidence: null },
      { key: "k2", content: "<p>b</p>", screenshotUrl: null, clickRect: null, confidence: null },
    ]);
    assert.equal(tree.items.length, 2);
    assert.deepEqual(
      tree.items.map((i) => i.key),
      ["k1", "k2"]
    );
    assert.equal(tree.items.every((i) => i.kind === "step"), true);
  });

  await test("serializeInteractive: stored tree passes through (independent of blocks)", async () => {
    const stored = {
      items: [
        { kind: "intro", key: "s1", title: "Hi", subtitle: "", buttons: [] },
        { kind: "step", key: "k9", content: "<p>independent</p>", screenshotKey: null },
      ],
    };
    // Blocks are DIFFERENT from the stored tree — must be ignored.
    const tree = await serializeInteractive(stored, [
      { key: "k1", content: "<p>list</p>", screenshotUrl: null, clickRect: null, confidence: null },
    ]);
    assert.equal(tree.items.length, 2);
    assert.equal(tree.items[0]!.kind, "intro");
    const step = tree.items[1]!;
    assert.equal(step.kind === "step" && step.content, "<p>independent</p>");
  });

  await test("swapAssetKey: an image edit updates BOTH trees (global)", async () => {
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
    // Both the block and its seeded interactive step share asset "a_k1".
    assert.equal(base.blocks[0]!.assetId, "a_k1");
    const swapped = swapAssetKey(base, "a_k1", "media/new.png");
    assert.equal(swapped.blocks[0]!.screenshotKey, "media/new.png");
    const step = swapped.interactive.items[0]!;
    assert.equal(step.kind === "step" && step.screenshotKey, "media/new.png");
    assert.deepEqual(swapped.assets[0], { id: "a_k1", key: "media/new.png" });
    // A different asset id is untouched.
    const noop = swapAssetKey(base, "a_other", "media/x.png");
    assert.equal(noop.blocks[0]!.screenshotKey, "media/old.png");
  });

  await test("interactive translation: collect strings + apply by stable key", async () => {
    const items = [
      {
        kind: "intro" as const,
        key: "s1",
        title: "Welcome",
        subtitle: "Quick tour",
        appearance: {
          background: { kind: "none" as const, value: null },
          theme: "light" as const,
          align: "center" as const,
          buttonColumns: 1 as const,
        },
        buttons: [
          {
            key: "b1",
            text: "Get started",
            destination: { kind: "next" as const },
            bgColor: "#000",
            textColor: "#fff",
          },
        ],
      },
      {
        kind: "step" as const,
        key: "k1",
        content: "<p>Click New</p>",
        screenshotKey: null,
        assetId: null,
        clickRect: null,
        confidence: null,
        calloutBg: null,
        calloutText: null,
      },
    ];
    const strings = collectInteractiveStrings(items);
    assert.deepEqual(
      strings.map((s) => s.id).sort(),
      ["b1", "k1", "s1#subtitle", "s1#title"]
    );

    const map = {
      "s1#title": "Bienvenue",
      "s1#subtitle": "Visite rapide",
      b1: "Commencer",
      k1: "<p>Cliquez Nouveau</p>",
    };
    const out = applyInteractiveTranslation(items, map);
    const intro = out[0]!;
    assert.equal(intro.kind === "intro" && intro.title, "Bienvenue");
    assert.equal(intro.kind === "intro" && intro.buttons[0]!.text, "Commencer");
    const step = out[1]!;
    assert.equal(step.kind === "step" && step.content, "<p>Cliquez Nouveau</p>");
    // A missing key falls back to the base text.
    const out2 = applyInteractiveTranslation(items, { k1: "x" });
    assert.equal(out2[0]!.kind === "intro" && out2[0]!.title, "Welcome");
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
