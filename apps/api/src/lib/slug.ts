import { randomBytes } from "node:crypto";

/**
 * URL-safe slug from a display name + short random suffix.
 * The suffix guarantees uniqueness without a lookup round-trip
 * ("acme" → "acme-x4k2"). Slugs are identifiers, not vanity URLs (yet).
 */
export function generateSlug(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "workspace";
  const suffix = randomBytes(3).toString("hex").slice(0, 4);
  return `${base}-${suffix}`;
}
