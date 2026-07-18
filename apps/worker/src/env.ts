import { z } from "zod";

/** Worker environment — validated at boot, fail fast. */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  /** At least one provider key must exist for the synthesize stage. */
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
  AI_MODEL: z.string().optional(),

  /** Cloudflare R2 — required for video ingestion + voiceover audio. */
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  /** ElevenLabs TTS — required for voiceover audio synthesis. */
  ELEVENLABS_API_KEY: z.string().optional(),

  /** PostHog product analytics — optional; analytics is a no-op when absent. */
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.url().optional(),

  // ── Stuck-capture reaper ────────────────────────────────────────────────
  /** How often the reaper sweeps for stuck captures (seconds). */
  REAPER_INTERVAL_SEC: z.coerce.number().int().positive().default(60),
  /** UPLOADING longer than this = abandoned upload → FAILED (minutes). */
  STUCK_UPLOAD_TIMEOUT_MIN: z.coerce.number().positive().default(10),
  /** PROCESSING longer than this = lost/dead job → FAILED (minutes).
   *  Generous: long video ingests are legitimately slow. */
  STUCK_PROCESSING_TIMEOUT_MIN: z.coerce.number().positive().default(20),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

if (
  (env.AI_PROVIDER === "openai" && !env.OPENAI_API_KEY) ||
  (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY)
) {
  console.error(
    `❌ AI_PROVIDER is "${env.AI_PROVIDER}" but its API key is not set.`
  );
  process.exit(1);
}
