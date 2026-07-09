import type { GuideBlock } from "@/lib/guides"

export type PublicGuide = {
  title: string
  summary: string | null
  workspaceName: string
  publishedAt: string | null
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
