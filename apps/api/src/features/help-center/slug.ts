/**
 * Slug helpers for Help Center collections + articles. Pure (the DB lookup is
 * injected as a predicate) so uniqueness handling is unit-testable. Kept out of
 * the router for that reason, like the Forms `results.ts`.
 */

/** Clean, human, stable slug — no random suffix (public URLs are vanity). */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "item"
  );
}

/**
 * A slug derived from `base`, suffixed (`-2`, `-3`, …) until `taken` returns
 * false. `taken` is the caller's uniqueness check (e.g. a DB lookup scoped to a
 * collection/center).
 */
export async function uniqueSlug(
  base: string,
  taken: (slug: string) => Promise<boolean>
): Promise<string> {
  const root = slugify(base);
  let slug = root;
  let i = 1;
  while (await taken(slug)) slug = `${root}-${++i}`;
  return slug;
}
