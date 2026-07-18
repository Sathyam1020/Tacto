// env must be imported first — it validates configuration and fails fast.
import { env } from "./env.js";

import { createElevenLabsProvider, registerSpeechProvider } from "@workspace/ai";

import { analytics } from "./lib/analytics.js";
import { createApp } from "./app.js";

// Register the TTS backend for synchronous voice previews (audio synthesis for
// guides runs on the worker; previews are quick + user-facing, so the API does
// them directly).
if (env.ELEVENLABS_API_KEY) {
  registerSpeechProvider(createElevenLabsProvider(env.ELEVENLABS_API_KEY));
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`tacto api listening on http://localhost:${env.PORT}`);
});

/** Graceful shutdown — stop accepting connections, flush batched analytics. */
async function shutdown(signal: string) {
  console.log(`${signal} received — shutting down…`);
  server.close();
  await analytics.shutdown();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
