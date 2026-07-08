import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Provider-agnostic model selection. Swapping providers is an env change
 * (AI_PROVIDER + AI_MODEL + the provider's API key), never a code change —
 * a founding architecture requirement.
 */

const DEFAULT_MODELS = {
  openai: "gpt-5-mini",
  anthropic: "claude-haiku-4-5",
} as const;

type Provider = keyof typeof DEFAULT_MODELS;

export function getModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER ?? "openai") as Provider;
  if (!(provider in DEFAULT_MODELS)) {
    throw new Error(
      `Unknown AI_PROVIDER "${provider}" — expected one of: ${Object.keys(DEFAULT_MODELS).join(", ")}`
    );
  }
  const modelId = process.env.AI_MODEL ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case "anthropic":
      return anthropic(modelId);
    case "openai":
      return openai(modelId);
  }
}
