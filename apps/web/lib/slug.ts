/**
 * URL-safe slug from a display name + short random suffix (browser-side
 * counterpart of apps/api/src/lib/slug.ts). The suffix avoids collisions
 * without a round-trip; slugs are identifiers, not vanity URLs (yet).
 */
export function generateSlug(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "workspace"
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}
