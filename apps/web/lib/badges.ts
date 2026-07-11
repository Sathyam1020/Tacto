/**
 * Traffic-light tiering for a completion percentage. Returns Tailwind classes
 * (background + text + ring) that resolve to theme-aware CSS variables, so the
 * same badge reads correctly on both the dark and light Linear surfaces. Each
 * tier's colors are defined once per theme (see the `--l-c*` vars) and meet AA.
 *
 *   < 50%   → red     (needs attention)
 *   50–74%  → amber   (in progress)
 *   75%+    → green   (healthy)
 */
export function getCompletionBadgeColor(percent: number): string {
  if (percent < 50)
    return "bg-[var(--l-clo-bg)] text-[var(--l-clo-fg)] ring-[var(--l-clo-ring)]"
  if (percent < 75)
    return "bg-[var(--l-cmid-bg)] text-[var(--l-cmid-fg)] ring-[var(--l-cmid-ring)]"
  return "bg-[var(--l-chi-bg)] text-[var(--l-chi-fg)] ring-[var(--l-chi-ring)]"
}
