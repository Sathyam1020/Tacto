import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  gatherVideoInputs,
  gatherVideoStyle,
  setVideoExportFailed,
  setVideoExportResult,
  videoSourceHash,
} from "@workspace/generation";
import { getObjectBytes, putObject } from "@workspace/storage";

import { probe, runFfmpeg } from "./ffmpeg.js";
import {
  FPS,
  INTRO_SEC,
  renderIntroFrames,
  renderSlideFrame,
  renderStepBase,
  type Point,
} from "./video-frame.js";

/**
 * Compose a guide's walkthrough into an MP4: each step's screenshot — rendered
 * into a browser-chrome frame with a caption bar — plays a short pointer intro
 * (glide in from the previous target, pulse on landing), then freezes for the
 * length of its narration audio (silent hold when there's none), then all steps
 * concatenate. The cursor's rest position is the next step's start point, so the
 * motion is continuous across cuts. Frames are composed with sharp; ffmpeg holds
 * the last frame (tpad) and muxes audio.
 */

const DEFAULT_HOLD_SEC = 4;
const SLIDE_HOLD_SEC = 3.5; // title-card hold when a slide has no narration
const AUDIO_TAIL_SEC = 0.6; // small pause after each narration clip

/**
 * filter_complex that mixes looping background music (input 1) under the
 * narration (input 0), ducking the music via sidechaincompress whenever
 * narration is present, and trimming to the narration's length. Output [a].
 */
function buildMusicMix(volume: number): string {
  const vol = volume.toFixed(3);
  return [
    // Split narration: one copy drives ducking, one is the final voice.
    `[0:a]asplit=2[sc][voice]`,
    // Base music level.
    `[1:a]volume=${vol}[music]`,
    // Duck the music while narration plays.
    `[music][sc]sidechaincompress=threshold=0.02:ratio=8:attack=5:release=300[ducked]`,
    // Mix voice + ducked music; stop at the narration (video) length.
    `[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`,
  ].join(";");
}

/** Encode tail — H.264 tuned for crisp screen text, plus AAC. */
const ENCODE_TAIL = [
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "20",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "160k",
  "-ar",
  "44100",
  "-ac",
  "2",
  "-y",
];

export async function composeGuideVideo(
  guideId: string,
  language: string,
  silent = false
): Promise<void> {
  const [items, style] = await Promise.all([
    gatherVideoInputs(guideId, language),
    gatherVideoStyle(guideId),
  ]);
  if (items.length === 0) {
    await setVideoExportFailed(
      guideId,
      language,
      silent,
      "No steps with screenshots to export"
    );
    return;
  }
  const sourceHash = videoSourceHash(items, style, silent);
  const dir = await mkdtemp(join(tmpdir(), "tacto-video-"));
  try {
    const segPaths: string[] = [];
    let lastTarget: Point | null = null; // carries the cursor across steps
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const segPath = join(dir, `seg${i}.mp4`);

      // Resolve narration audio (shared by steps + slides). A silent export
      // (no voiceover requested) drops all narration audio.
      const audioKey = silent ? null : item.audioKey;
      let audioPath: string | null = null;
      let audioLen = 0;
      if (audioKey) {
        audioPath = join(dir, `audio${i}.mp3`);
        await writeFile(audioPath, await getObjectBytes(audioKey));
        audioLen = (await probe(audioPath)).durationSec;
      }
      const audioArgs = audioPath
        ? ["-i", audioPath]
        : ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"];
      const afArgs = audioPath ? ["-af", "apad"] : [];

      // Emit a static-hold segment from a single still image. Pin fps so every
      // segment matches (a looped image defaults to 25fps → concat mismatch).
      const staticHold = async (imgPath: string, dur: number) => {
        await runFfmpeg([
          "-loop",
          "1",
          "-i",
          imgPath,
          ...audioArgs,
          "-vf",
          `fps=${FPS},setsar=1,format=yuv420p`,
          ...afArgs,
          "-t",
          dur.toFixed(3),
          ...ENCODE_TAIL,
          segPath,
        ]);
      };

      if (item.kind === "slide") {
        // Title card: no cursor. Reset carry-over so the next step's pointer
        // appears fresh rather than gliding across the slide.
        lastTarget = null;
        const png = await renderSlideFrame({
          title: item.title,
          subtitle: item.subtitle,
          appearance: item.appearance,
          style,
        });
        const slidePath = join(dir, `slide${i}.png`);
        await writeFile(slidePath, png);
        await staticHold(
          slidePath,
          audioPath ? audioLen + AUDIO_TAIL_SEC : SLIDE_HOLD_SEC
        );
        segPaths.push(segPath);
        continue;
      }

      const { png: basePng, target } = await renderStepBase(
        await getObjectBytes(item.screenshotKey),
        { clickRect: item.clickRect, caption: item.text, style }
      );

      if (target) {
        // Animated intro (glide + landing pulse) → freeze last frame for hold.
        const from = lastTarget ?? target;
        lastTarget = target;
        const frames = await renderIntroFrames(basePng, { from, target, style });
        const stepDir = join(dir, `step${i}`);
        await mkdir(stepDir);
        await Promise.all(
          frames.map((f, k) =>
            writeFile(join(stepDir, `f${String(k).padStart(4, "0")}.png`), f)
          )
        );
        // With audio: hold for the narration. Without (silent/partial): a
        // readable default hold, never shorter than the intro animation.
        const holdBase = audioPath ? audioLen + AUDIO_TAIL_SEC : DEFAULT_HOLD_SEC;
        const dur = Math.max(holdBase, INTRO_SEC);
        const holdDur = dur - INTRO_SEC;
        await runFfmpeg([
          "-framerate",
          `${FPS}`,
          "-i",
          join(stepDir, "f%04d.png"),
          ...audioArgs,
          "-vf",
          `tpad=stop_mode=clone:stop_duration=${holdDur.toFixed(3)},setsar=1,format=yuv420p`,
          ...afArgs,
          "-t",
          dur.toFixed(3),
          ...ENCODE_TAIL,
          segPath,
        ]);
      } else {
        // No pointer (highlight-box or no click point): static hold.
        const basePath = join(dir, `base${i}.png`);
        await writeFile(basePath, basePng);
        await staticHold(basePath, audioPath ? audioLen + AUDIO_TAIL_SEC : DEFAULT_HOLD_SEC);
      }
      segPaths.push(segPath);
    }

    // Concatenate the identically-encoded segments (fast stream copy for video;
    // re-encode audio to normalize per-clip encoder padding so narration
    // survives the concat).
    const listPath = join(dir, "list.txt");
    await writeFile(
      listPath,
      segPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
    );
    const concatPath = join(dir, "guide.mp4");
    await runFfmpeg([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      "-y",
      concatPath,
    ]);

    // Mix background music under the narration (ducked while narration plays).
    // A silent export carries no audio at all — skip music too.
    let outPath = concatPath;
    if (!silent && style.musicKey && style.musicVolume > 0) {
      const musicPath = join(dir, "music.mp3");
      await writeFile(musicPath, await getObjectBytes(style.musicKey));
      // Hard-cap the output at the video length so the looping music can't run
      // past it (a bare -stream_loop -1 has no natural end).
      const videoDur = (await probe(concatPath)).durationSec;
      outPath = join(dir, "final.mp4");
      await runFfmpeg([
        "-i",
        concatPath,
        // Loop the track to cover the whole video; -t trims to the video.
        "-stream_loop",
        "-1",
        "-i",
        musicPath,
        "-filter_complex",
        buildMusicMix(style.musicVolume),
        "-map",
        "0:v",
        "-map",
        "[a]",
        "-t",
        videoDur.toFixed(3),
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        "-y",
        outPath,
      ]);
    }

    const bytes = await readFile(outPath);
    const r2Key = `exports/${guideId}/${language}${silent ? "-novoice" : ""}.mp4`;
    await putObject(r2Key, bytes, "video/mp4");
    const total = await probe(outPath);
    await setVideoExportResult(guideId, language, silent, {
      r2Key,
      sourceHash,
      sizeBytes: bytes.byteLength,
      durationMs: Math.round(total.durationSec * 1000),
    });
  } catch (err) {
    await setVideoExportFailed(
      guideId,
      language,
      silent,
      err instanceof Error ? err.message : "video export failed"
    );
    throw err;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
