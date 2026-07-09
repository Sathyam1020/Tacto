import { createRequire } from "node:module";

import { execa } from "execa";

/**
 * Thin ffmpeg/ffprobe wrappers. ffmpeg-static bundles the ffmpeg binary;
 * ffprobe functionality is emulated with ffmpeg itself where needed to
 * avoid a second binary dependency.
 *
 * ffmpeg-static is CJS (module.exports = path) — createRequire sidesteps
 * its broken default-export typing under NodeNext.
 */
const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;

if (!ffmpegPath) {
  throw new Error("ffmpeg-static did not provide a binary for this platform");
}
const FFMPEG: string = ffmpegPath;

export type ProbeResult = {
  durationSec: number;
  hasAudio: boolean;
};

/** Duration + audio presence, parsed from ffmpeg's stream info output. */
export async function probe(videoPath: string): Promise<ProbeResult> {
  // `ffmpeg -i` exits non-zero without an output file — expected; parse stderr.
  const { stderr } = await execa(FFMPEG, ["-i", videoPath], { reject: false });

  const durationMatch = stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!durationMatch) {
    // WebM from MediaRecorder often lacks a duration header — decode to find out.
    const { stderr: decodeStderr } = await execa(
      FFMPEG,
      ["-i", videoPath, "-f", "null", "-"],
      { reject: false }
    );
    const timeMatches = [...decodeStderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
    const last = timeMatches[timeMatches.length - 1];
    if (!last) throw new Error("Could not determine video duration");
    return {
      durationSec:
        Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]),
      hasAudio: /Stream #\d+:\d+.*Audio:/.test(stderr),
    };
  }

  return {
    durationSec:
      Number(durationMatch[1]) * 3600 +
      Number(durationMatch[2]) * 60 +
      Number(durationMatch[3]),
    hasAudio: /Stream #\d+:\d+.*Audio:/.test(stderr),
  };
}

/** Extract mono 16k wav for transcription. */
export async function extractAudio(
  videoPath: string,
  outPath: string
): Promise<void> {
  await execa(FFMPEG, [
    "-y",
    "-i",
    videoPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    outPath,
  ]);
}

/**
 * Candidate-moment timestamps: ffmpeg scene changes UNION a uniform
 * sampling grid.
 *
 * UI recordings change few pixels per interaction — scene scores are tiny
 * compared to film cuts, so scene detection alone misses almost everything
 * (a 26s recording once yielded 1 moment). The grid guarantees coverage;
 * the vision stage downstream is the judge of what's meaningful.
 */
export async function detectSceneChanges(
  videoPath: string,
  durationSec: number,
  threshold = 0.008,
  minGapSec = 1.5,
  gridStepSec = 3,
  maxMoments = 40
): Promise<number[]> {
  const { stderr } = await execa(
    FFMPEG,
    [
      "-i",
      videoPath,
      "-filter:v",
      `select='gt(scene,${threshold})',showinfo`,
      "-f",
      "null",
      "-",
    ],
    { reject: false }
  );

  const sceneTimes = [...stderr.matchAll(/pts_time:(\d+\.?\d*)/g)].map((m) =>
    Number(m[1])
  );

  // Uniform grid floor: a moment every gridStepSec across the recording.
  const gridTimes: number[] = [];
  for (let t = 0; t < durationSec - 0.5; t += gridStepSec) {
    gridTimes.push(t);
  }

  const candidates = [...new Set([...sceneTimes, ...gridTimes])].sort(
    (a, b) => a - b
  );

  const spaced: number[] = [];
  for (const t of candidates) {
    const last = spaced[spaced.length - 1];
    if (last === undefined || t - last >= minGapSec) {
      spaced.push(t);
      if (spaced.length >= maxMoments) break;
    }
  }
  return spaced;
}

/** Extract a single frame as JPEG bytes (scaled to a max width). */
export async function extractFrame(
  videoPath: string,
  timeSec: number,
  maxWidth = 1280
): Promise<Uint8Array> {
  const { stdout } = await execa(
    FFMPEG,
    [
      "-ss",
      timeSec.toFixed(3),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      `scale='min(${maxWidth},iw)':-2`,
      "-f",
      "image2",
      "-c:v",
      "mjpeg",
      "-q:v",
      "4",
      "pipe:1",
    ],
    { encoding: "buffer" }
  );
  return new Uint8Array(stdout);
}
