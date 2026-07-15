import type { FormDocument } from "@workspace/contracts/form"
import type {
  Faq,
  FormEmbed,
  GuideCustomization,
  InteractivePresentation,
} from "@workspace/contracts/guide"

/** A guide's form embed with its referenced published form inlined. */
export type PublicGuideEmbed = FormEmbed & {
  form: { shareId: string | null; version: number; document: FormDocument }
}

import type { GuideBlock } from "@/lib/guides"

export type GuideReactionCount = { emoji: string; count: number }
export type GuideComment = {
  id: string
  authorName: string
  body: string
  createdAt: string
}

export type PublicTranslation = {
  language: string
  title: string
  summary: string | null
  /** Translated block content. The v3 form is a `{ blockKey: content }` record;
   *  legacy rows are a `[{ index, content }]` array. Normalize with
   *  `readTranslationSteps(steps, orderedKeys)` before use. */
  steps: unknown
  /** Slide text keyed by stable slide-string id (null = not translated). */
  interactive: Record<string, string> | null
}

export type PublicGuide = {
  shareId: string
  title: string
  summary: string | null
  workspaceName: string
  publishedAt: string | null
  customization: GuideCustomization | null
  reactions: GuideReactionCount[]
  comments: GuideComment[]
  translations: PublicTranslation[]
  blocks: GuideBlock[]
  /** The published Interactive *presentation* (slides + per-step overrides).
   *  Step content/screenshots come from `blocks`. */
  interactive: InteractivePresentation
  /** Published voiceover audio per language → per anchor (presigned). */
  narration: Record<string, Record<string, { text: string; audioUrl: string }>>
  /** Published FAQ list. */
  faqs: Faq[]
  /** Form overlays with their forms inlined. */
  embeds: PublicGuideEmbed[]
}

/** Server-side fetch of a published guide by shareId (public, no auth). */
export async function fetchPublicGuide(
  shareId: string
): Promise<PublicGuide | null> {
  const base = process.env.API_URL ?? "http://localhost:4100"
  try {
    const res = await fetch(`${base}/api/public/guides/${shareId}`, {
      // Always fresh: view counts + presigned URLs must not be cached.
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { guide: PublicGuide }
    return data.guide
  } catch {
    return null
  }
}
