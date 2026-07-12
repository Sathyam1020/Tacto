import type { GuideCustomization } from "@workspace/contracts/guide"

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
  /** Per-block content keyed by block position (index). */
  steps: { index: number; content: string }[]
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
}

/** Server-side fetch of a published guide by shareId (public, no auth). */
export async function fetchPublicGuide(
  shareId: string
): Promise<PublicGuide | null> {
  const base = process.env.API_URL ?? "http://localhost:4000"
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
