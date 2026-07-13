// env must be imported first — it validates configuration and fails fast.
import { env } from "./env.js";

import { createElevenLabsProvider, registerSpeechProvider } from "@workspace/ai";

import { createApp } from "./app.js";

// Register the TTS backend for synchronous voice previews (audio synthesis for
// guides runs on the worker; previews are quick + user-facing, so the API does
// them directly).
if (env.ELEVENLABS_API_KEY) {
  registerSpeechProvider(createElevenLabsProvider(env.ELEVENLABS_API_KEY));
}

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`tacto api listening on http://localhost:${env.PORT}`);
});
