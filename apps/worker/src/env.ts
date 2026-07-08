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
