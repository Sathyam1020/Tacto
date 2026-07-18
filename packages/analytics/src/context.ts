/**
 * Automatic metadata attached to every event, so callers never have to remember
 * common fields. Each client (browser / server / extension) supplies its
 * platform + build info once at construction; the client merges these into
 * every `capture`. PostHog adds the server-side event timestamp itself.
 */
export type Platform = "web" | "server" | "extension"

export type AnalyticsContext = {
  /** "production" | "preview" | "development" | … */
  environment?: string
  /** Human app version (e.g. package.json version). */
  appVersion?: string
  /** Git commit SHA of the running build, when the host exposes one. */
  buildSha?: string
}

/** Super-properties merged into every event for a platform. */
export function contextProperties(
  platform: Platform,
  ctx: AnalyticsContext
): Record<string, string> {
  const props: Record<string, string> = { platform }
  if (ctx.environment) props.environment = ctx.environment
  if (ctx.appVersion) props.app_version = ctx.appVersion
  if (ctx.buildSha) props.build_sha = ctx.buildSha
  return props
}
