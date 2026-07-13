import assert from "node:assert/strict";

import {
  narrationSourceFingerprint,
  registerSpeechProvider,
  renderHash,
  getSpeechProvider,
  hasSpeechProvider,
  type RenderIdentity,
  type SpeechProvider,
} from "@workspace/ai";
import {
  DEFAULT_CUSTOMIZATION,
  DEFAULT_VOICE_SETTINGS,
  resolveCustomization,
  voiceForLanguage,
  voiceSettingsSchema,
} from "@workspace/contracts/guide";
import {
  BASE_LANGUAGE,
  computeNarrationStaleness,
  DEFAULT_VOICE_ID,
  narrationAiSchema,
  narrationSegmentSchema,
  voiceJobSchema,
  VOICE_CATALOG,
  voiceOption,
} from "@workspace/contracts/voice";
import { prisma } from "@workspace/db";
import { collectOrphanRenders } from "@workspace/generation";

/**
 * Voice subsystem — Phase 1 regression (domain + settings + provider + jobs).
 * Pure checks plus a light assertion that the new Prisma models are wired.
 * Run: `npm test -w api`.
 */

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.message : err);
  }
}
async function atest(name: string, fn: () => Promise<void>) {
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
  console.log("voice domain (Phase 1)");

  test("voice settings default is wired into customization", () => {
    assert.deepEqual(
      DEFAULT_CUSTOMIZATION.walkthroughView.voice,
      DEFAULT_VOICE_SETTINGS
    );
    assert.equal(DEFAULT_VOICE_SETTINGS.enabled, false); // opt-in
    // A guide with no customization resolves to the voice defaults.
    const resolved = resolveCustomization(null);
    assert.deepEqual(resolved.walkthroughView.voice, DEFAULT_VOICE_SETTINGS);
  });

  test("resolveCustomization merges partial voice + voiceByLanguage", () => {
    const resolved = resolveCustomization({
      walkthroughView: {
        voice: {
          enabled: true,
          defaultVoiceId: "v_default",
          voiceByLanguage: { fr: "v_fr" },
        },
      },
    } as never);
    const v = resolved.walkthroughView.voice;
    assert.equal(v.enabled, true);
    assert.equal(v.defaultVoiceId, "v_default");
    assert.equal(v.speed, DEFAULT_VOICE_SETTINGS.speed); // untouched default kept
    assert.deepEqual(v.voiceByLanguage, { fr: "v_fr" });
  });

  test("voiceSettingsSchema rejects out-of-range speed", () => {
    assert.equal(
      voiceSettingsSchema.safeParse({ ...DEFAULT_VOICE_SETTINGS, speed: 5 })
        .success,
      false
    );
    assert.equal(
      voiceSettingsSchema.safeParse(DEFAULT_VOICE_SETTINGS).success,
      true
    );
  });

  test("voiceForLanguage: per-language override wins, else default, else null", () => {
    const settings = {
      ...DEFAULT_VOICE_SETTINGS,
      defaultVoiceId: "v_default",
      voiceByLanguage: { fr: "v_fr" },
    };
    assert.equal(voiceForLanguage(settings, "fr"), "v_fr");
    assert.equal(voiceForLanguage(settings, "es"), "v_default");
    assert.equal(
      voiceForLanguage({ ...settings, defaultVoiceId: null }, "es"),
      null
    );
  });

  test("narrationSegmentSchema applies defaults", () => {
    const seg = narrationSegmentSchema.parse({
      anchorKey: "k1",
      text: "Now click New.",
    });
    assert.equal(seg.markup, null);
    assert.equal(seg.humanEdited, false);
    assert.equal(seg.sourceFingerprint, null);
    assert.equal(seg.status, "ready");
    assert.equal(BASE_LANGUAGE, "en");
  });

  test("voiceJobSchema parses each kind, rejects bad payloads", () => {
    assert.equal(
      voiceJobSchema.safeParse({
        kind: "narration.generate",
        guideId: "g",
        language: "en",
      }).success,
      true
    );
    assert.equal(
      voiceJobSchema.safeParse({
        kind: "voice.synthesize",
        guideId: "g",
        language: "en",
        anchorKey: "k1",
      }).success,
      true
    );
    // Unknown kind and a synth job missing anchorKey are rejected.
    assert.equal(
      voiceJobSchema.safeParse({ kind: "voice.explode", guideId: "g" }).success,
      false
    );
    assert.equal(
      voiceJobSchema.safeParse({
        kind: "voice.synthesize",
        guideId: "g",
        language: "en",
      }).success,
      false
    );
  });

  test("renderHash is deterministic and content-addressed", () => {
    const base: RenderIdentity = {
      kind: "audio",
      provider: "elevenlabs",
      model: "eleven_multilingual_v2",
      voiceId: "v1",
      format: "mp3",
      speed: 1,
      style: null,
      payload: "Now click the New button.",
    };
    // Same inputs → same hash (cache/dedup).
    assert.equal(renderHash(base), renderHash({ ...base }));
    // Any material change → a different hash (invalidation).
    assert.notEqual(renderHash(base), renderHash({ ...base, voiceId: "v2" }));
    assert.notEqual(renderHash(base), renderHash({ ...base, payload: "x" }));
    assert.notEqual(renderHash(base), renderHash({ ...base, speed: 1.2 }));
    assert.notEqual(renderHash(base), renderHash({ ...base, provider: "openai" }));
    // sha256 hex.
    assert.match(renderHash(base), /^[0-9a-f]{64}$/);
  });

  test("narrationSourceFingerprint is deterministic + distinguishing", () => {
    assert.equal(
      narrationSourceFingerprint("Click New"),
      narrationSourceFingerprint("Click New")
    );
    assert.notEqual(
      narrationSourceFingerprint("Click New"),
      narrationSourceFingerprint("Click Save")
    );
  });

  test("speech provider registry: register / has / get / unknown throws", () => {
    const fake: SpeechProvider = {
      name: "__test_provider__",
      synthesize: async () => ({ audio: new Uint8Array(), format: "mp3" }),
    };
    assert.equal(hasSpeechProvider(fake.name), false);
    registerSpeechProvider(fake);
    assert.equal(hasSpeechProvider(fake.name), true);
    assert.equal(getSpeechProvider(fake.name), fake);
    assert.throws(() => getSpeechProvider("__nope__"), /No speech provider/);
  });

  test("narrationAiSchema: every field REQUIRED (OpenAI strict)", () => {
    const inner = narrationAiSchema.shape.segments.element.shape as Record<
      string,
      { isOptional: () => boolean }
    >;
    for (const [name, field] of Object.entries(inner)) {
      assert.equal(field.isOptional(), false, `${name} must be required`);
    }
  });

  test("computeNarrationStaleness: fresh / stale / missing / orphaned", () => {
    const segments = [
      { anchorKey: "k1", sourceFingerprint: "fp1" },
      { anchorKey: "k2", sourceFingerprint: "fp2_old" },
      { anchorKey: "kGone", sourceFingerprint: "fpx" },
    ];
    const current = { k1: "fp1", k2: "fp2_new", k3: "fp3" };
    const st = computeNarrationStaleness(segments, current);
    assert.equal(st.stale, true);
    assert.deepEqual(st.staleAnchors, ["k2"]); // fingerprint drifted
    assert.deepEqual(st.missingAnchors, ["k3"]); // in guide, no segment
    assert.deepEqual(st.orphanedAnchors, ["kGone"]); // segment, no anchor

    // All fresh → not stale.
    const fresh = computeNarrationStaleness(
      [{ anchorKey: "k1", sourceFingerprint: "fp1" }],
      { k1: "fp1" }
    );
    assert.equal(fresh.stale, false);
  });

  test("VOICE_CATALOG: unique ids, default present, Indian voices offered", () => {
    const ids = VOICE_CATALOG.map((v) => v.id);
    assert.equal(new Set(ids).size, ids.length, "voice ids must be unique");
    assert.ok(ids.includes(DEFAULT_VOICE_ID), "default voice must be in catalog");
    assert.ok(
      VOICE_CATALOG.some((v) => v.accent === "Indian"),
      "catalog must offer Indian voices"
    );
    assert.equal(voiceOption(DEFAULT_VOICE_ID)?.name, "Rachel");
    assert.equal(voiceOption("nope"), undefined);
    assert.equal(voiceOption(null), undefined);
  });

  test("prisma voice models are wired", () => {
    assert.equal(typeof prisma.narration.findMany, "function");
    assert.equal(typeof prisma.narrationSegment.findMany, "function");
    assert.equal(typeof prisma.mediaRender.findMany, "function");
    assert.equal(typeof prisma.segmentRenderRef.findMany, "function");
  });

  await atest("collectOrphanRenders removes only unreferenced renders", async () => {
    const guide = await prisma.guide.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (!guide) {
      console.log("    (skipped: no guide)");
      return;
    }
    const gid = guide.id;
    const tag = `__gc_test_${process.pid}__`;

    // An orphan render (no segment ref) + a referenced one.
    const orphan = await prisma.mediaRender.create({
      data: { guideId: gid, renderHash: `${tag}orphan`, kind: "audio", provider: "x", voiceId: "v", format: "mp3", status: "ready" },
      select: { id: true },
    });
    const nar = await prisma.narration.create({
      data: { guideId: gid, language: tag, status: "ready" },
      select: { id: true },
    });
    const seg = await prisma.narrationSegment.create({
      data: { narrationId: nar.id, anchorKey: "k", text: "t" },
      select: { id: true },
    });
    const kept = await prisma.mediaRender.create({
      data: { guideId: gid, renderHash: `${tag}kept`, kind: "audio", provider: "x", voiceId: "v", format: "mp3", status: "ready" },
      select: { id: true },
    });
    await prisma.segmentRenderRef.create({
      data: { segmentId: seg.id, kind: "audio", renderId: kept.id },
    });
    // Backdate past the grace window so the default sweep considers them.
    await prisma.$executeRawUnsafe(
      `UPDATE media_render SET "updatedAt" = now() - interval '2 hours' WHERE id = $1 OR id = $2`,
      orphan.id,
      kept.id
    );

    await collectOrphanRenders();

    assert.equal(
      await prisma.mediaRender.findUnique({ where: { id: orphan.id } }),
      null,
      "orphan render should be deleted"
    );
    assert.notEqual(
      await prisma.mediaRender.findUnique({ where: { id: kept.id } }),
      null,
      "referenced render should be kept"
    );

    await prisma.narration.deleteMany({ where: { guideId: gid, language: tag } });
    await prisma.mediaRender.deleteMany({ where: { id: kept.id } });
  });

  await prisma.$disconnect();
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll voice domain tests passed");
}

void main();
