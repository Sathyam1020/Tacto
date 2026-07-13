export { describeMoments, type Moment } from "./describe-moments.js";
export { importStepsFromText } from "./import-document.js";
export { generateNarration } from "./generate-narration.js";
export { getModel } from "./model.js";
export {
  createElevenLabsProvider,
  ELEVENLABS_DEFAULT_VOICE,
  ELEVENLABS_MODEL,
} from "./providers/elevenlabs.js";
export {
  getSpeechProvider,
  hasSpeechProvider,
  narrationSourceFingerprint,
  registerSpeechProvider,
  renderHash,
  type RenderIdentity,
  type SpeechProvider,
  type SpeechSynthesisRequest,
  type SpeechSynthesisResult,
} from "./speech.js";
export { translateGuide, translateStrings } from "./translate-guide.js";
export { synthesizeGuide } from "./synthesize-guide.js";
export {
  transcribeAudio,
  type TranscriptSegment,
} from "./transcribe-audio.js";
