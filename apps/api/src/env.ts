import { z } from "zod";

/**
 * Environment contract — validated once at boot, fail fast with a readable
 * error. Env vars are loaded by the runtime (`tsx --env-file=.env`), never
 * scattered `process.env` reads elsewhere in the codebase.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4100),

  /** Neon PostgreSQL connection string. */
  DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid URL" }),

  /** Secret for signing sessions/tokens. Generate: openssl rand -base64 32 */
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  /**
   * Public origin the auth endpoints are reachable at. Because the web app
   * proxies /api/* to this server, this is the WEB origin, not :4100.
   */
  BETTER_AUTH_URL: z.url(),

  /**
   * Web app origin(s) trusted for auth + CORS. Comma-separated so apex, www,
   * and Vercel preview domains can all be allowed, e.g.
   * "https://tacto.fyi,https://www.tacto.fyi".
   */
  WEB_ORIGIN: z
    .string()
    .default("http://localhost:3100")
    .refine(
      (s) => s.split(",").every((o) => URL.canParse(o.trim())),
      "WEB_ORIGIN must be a comma-separated list of valid URLs"
    ),

  /** Redis, for enqueueing capture-processing jobs. */
  REDIS_URL: z.url().default("redis://localhost:6379"),

  /** Cloudflare R2 — optional until configured; video capture 503s without. */
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  /** ElevenLabs TTS — enables synchronous voice previews in the editor. */
  ELEVENLABS_API_KEY: z.string().optional(),

  /** Google OAuth — optional; the google provider is disabled when absent. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  /** PostHog product analytics — optional; analytics is a no-op when absent. */
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.url().optional(),

  /** OTLP logs → PostHog Logs. Logs go to stdout only when unset. */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  /** OTLP headers as "k=v,k2=v2", e.g. "Authorization=Bearer phc_…". */
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

/**
 * WEB_ORIGIN parsed into a normalized allowlist (trailing slash stripped so
 * "https://tacto.fyi/" and "https://tacto.fyi" compare equal). Used by CORS and
 * better-auth trustedOrigins.
 */
export const webOrigins = env.WEB_ORIGIN.split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);
