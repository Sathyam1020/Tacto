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
  PORT: z.coerce.number().int().positive().default(4000),

  /** Neon PostgreSQL connection string. */
  DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid URL" }),

  /** Secret for signing sessions/tokens. Generate: openssl rand -base64 32 */
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  /**
   * Public origin the auth endpoints are reachable at. Because the web app
   * proxies /api/* to this server, this is the WEB origin, not :4000.
   */
  BETTER_AUTH_URL: z.url(),

  /** Web app origin, trusted for auth requests. */
  WEB_ORIGIN: z.url().default("http://localhost:3000"),

  /** Redis, for enqueueing capture-processing jobs. */
  REDIS_URL: z.url().default("redis://localhost:6379"),

  /** Google OAuth — optional; the google provider is disabled when absent. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
