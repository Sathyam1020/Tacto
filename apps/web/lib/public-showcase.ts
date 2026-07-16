import type { PublicShowcase } from "@workspace/contracts/showcase"

export type {
  PublicShowcase,
  PublicShowcaseSection,
  ShowcaseItemPayload,
} from "@workspace/contracts/showcase"

const base = process.env.API_URL ?? "http://localhost:4100"

/** Server-side fetch of a public showcase by slug (owner-previewable; noindex
 *  until published + listed). */
export async function fetchShowcase(slug: string): Promise<PublicShowcase | null> {
  try {
    const res = await fetch(`${base}/api/public/showcase/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    const d = (await res.json()) as { showcase: PublicShowcase }
    return d.showcase ?? null
  } catch {
    return null
  }
}
