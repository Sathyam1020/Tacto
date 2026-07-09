# Tacto — Phase 4: In-browser screen recording → video pipeline

## Context

Phase 3 proved the synthesis pipeline on fixture events. Phase 4 gives users a **real capture surface without waiting for the extension**: record the screen from the web app itself (`getDisplayMedia` + `MediaRecorder`), upload to R2, and a new **video-ingestion stage** reconstructs the normalized event log (the same `captureEventSchema` the extension will emit) from frames + narration. Everything downstream is untouched. Bonus: extracted frames become **real screenshots on steps and real cover images**.

Deliberate framing: video-derived guides are ~70%-fidelity **drafts** (confidence flags on steps); the extension later raises the ceiling to ~95%. The UX must say "review your draft", not promise perfection.

Research findings (verified):
- AI SDK v7 `transcribe()` is **stable** — `openai.transcription('gpt-4o-mini-transcribe')`, accepts Buffer.
- Vision via `generateText` with image content parts (same v7 API family already in packages/ai).
- `ffmpeg-static@5.3` bundles the binary (no brew dependency) + `execa@9.6` to drive it.
- R2 is S3-compatible: `@aws-sdk/client-s3@3.1082` + `@aws-sdk/s3-request-presigner`.
- Recording: `MediaRecorder` `video/webm;codecs=vp9` (Chrome/Edge; Safari emits mp4 — ffmpeg normalizes both). Bitrate capped ~2.5 Mbps → 5-min video ≤ ~95 MB.

**User setup required (5 min, like Neon/Redis):** create a Cloudflare R2 bucket `tacto-captures` + S3 API token, paste 4 values (account id, access key, secret, bucket name); apply a CORS rule (exact JSON provided) so the browser can PUT directly. I'll walk through it after approval.

## Architecture decisions (flagged)

- **Single presigned PUT** upload for MVP (bitrate-capped size makes this safe); resumable multipart is a fast-follow, not now.
- **Private bucket + presigned GET** — API mints short-lived URLs when serving guides; nothing public.
- **Moment detection via ffmpeg scene filter** (`select='gt(scene,T)'`) + always-include-first-frame, capped at 40 moments — no extra CV deps (no sharp) for MVP.
- **Mic narration = opt-in toggle** in the record dialog (default off, privacy-safe). When present, it's the biggest quality lever: transcript feeds both moment understanding and the writer.
- Derived events are written back to `Capture.events` (raw video stays the immutable source in R2).
- **5-min cap** enforced twice: client auto-stop timer + server `ffprobe` check.

## What gets built

### 1. Storage layer (`packages/storage`, new)
S3 client configured for R2 (`https://<account>.r2.cloudflarestorage.com`), helpers: `presignPut(key, contentType)`, `presignGet(key)`, `putObject`, `getObject`. Used by api (presign) and worker (frames upload, video download). Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

### 2. Schema (`packages/db`) — migration `add-video-capture`
- `Capture` += `videoKey String?`, `durationSec Float?`; `events` becomes optional (`Json?`) — video captures start without events
- (Step already has `screenshotUrl` — stores the R2 **key**; API converts to presigned URL at read time)

### 3. Contracts (`packages/contracts`)
- `createVideoCaptureSchema` (title?, mimeType), `completeCaptureSchema`
- Capture status shapes for polling; `CaptureJobData` unchanged (worker branches on `capture.source`)

### 4. API (`apps/api`, capture feature grows)
- `POST /api/captures/video` → create Capture (`VIDEO_UPLOAD`, `UPLOADING`, key `captures/<org>/<id>/raw.webm`) + presigned PUT URL
- `POST /api/captures/:id/complete` → flip to `PROCESSING`, enqueue
- Guide endpoints: map step `screenshotUrl` keys → presigned GET URLs in responses
- Env += R2 vars

### 5. Worker — video ingestion (`apps/worker/src/pipeline/ingest-video.ts`)
Branch in `processCapture` when `source === VIDEO_UPLOAD` and no events yet:
1. **fetch** video from R2 to tmp dir
2. **probe** (ffprobe): duration → enforce ≤ 300s, persist `durationSec`; detect audio stream
3. **transcribe** (if audio): ffmpeg → 16k mono wav → AI SDK `transcribe()` → timestamped text
4. **detect moments**: ffmpeg scene filter → timestamps (cap 40, min-gap 1.5s, always t=0)
5. **extract frames**: full-res frame at each moment (+300ms after-frame) → upload to R2 (`frames/<captureId>/…jpg`)
6. **understand** (packages/ai, new `describeMoments`): per moment, before/after frames + transcript window → vision model → normalized `CaptureEvent` with `confidence` + `screenshotId`
7. write derived events to `Capture.events` → fall through to the **existing** normalize → segment → synthesize → assemble (assemble now maps `screenshotId` → frame key on `Step.screenshotUrl`)
Cleanup tmp files; all stages logged; FAILED path unchanged.

### 6. AI layer (`packages/ai`)
- `describe-moments.ts`: vision prompt — "before/after screenshots + what the narrator said → what action was taken (click/input/navigation), element label, confidence; noise → null". Batched with bounded concurrency (4). Uses `getModel()` (gpt-5-mini is vision-capable).
- `transcribe-audio.ts`: thin wrapper over AI SDK `transcribe()`.

### 7. Web — the Capture button becomes real (`apps/web`)
- `components/capture-recorder.tsx` + `lib/use-screen-recorder.ts`:
  - Capture button (navbar) → dialog: what you'll record + **mic toggle** → `getDisplayMedia` picker → recording
  - Recording state in navbar: `TouchRing` pulse in **signal red** + mono elapsed timer + Stop button; auto-stop at 5:00
  - Stop → title prompt (prefilled "Untitled capture") → create → PUT to R2 (upload progress) → complete → toast
- Home: captures in `UPLOADING/PROCESSING` render as processing cards (TouchRing `processing`, poll `GET /api/captures/:id`) → swap to real card when READY. Needs a small `GET /api/captures?active=1` list endpoint for in-flight captures.
- Guide view + cards: render real screenshots when present (`screenshotUrl`), tinted fallback otherwise. Steps with `confidence < 0.7` get a quiet "review" `Badge`.
- Draft framing: guide header shows "Draft — generated from your recording. Review the steps." for video-sourced guides.

### 8. Plan stored in codebase
`docs/plans/phase-04-screen-recording.md` (step 1, per convention). turbo `globalEnv` += R2 vars.

## Order of implementation
1. docs copy + R2 setup (user) + env wiring
2. packages/storage → 3. schema migration → 4. contracts → 5. api endpoints
6. packages/ai (describeMoments, transcribe) → 7. worker ingestion
8. web recorder + processing cards + screenshot rendering
9. E2E verification

## Verification (end-to-end)
1. R2 smoke test: presign PUT via script, upload a file, presigned GET reads it back
2. Record a real ~1-min workflow in the browser (founder does this — the first true dogfood) → watch worker logs: probe → transcribe → moments → frames → understand → synthesize
3. Guide appears with **real screenshots** on steps and cover; low-confidence steps flagged
4. Caps: >5-min upload rejected by ffprobe path (fixture: ffmpeg-generated 6-min test video); oversized/broken file → FAILED with message, no orphan guide
5. No-audio recording still produces a guide (transcript stage skipped cleanly)
6. Workspace scoping on new endpoints (second account 404s); presigned URLs expire (spot-check TTL)
7. `turbo typecheck && lint && build` green; cost spot-check: log token usage for one run, confirm cents-not-dollars
8. Founder quality gate on the draft guide — iterate the vision/synthesis prompts if steps misread the recording

## Out of scope (this phase)
Chrome extension, resumable multipart upload, webcam bubble/Loom-style overlays, guide editor (still read-only + review badges), publishing, Loom import (trivial later: fetch → same pipeline), trimming/editing the video itself.
