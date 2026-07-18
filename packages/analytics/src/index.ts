/**
 * @workspace/analytics — the ONLY place in the repo that knows about PostHog.
 * Nothing else imports posthog-js or posthog-node directly.
 *
 * Public surface:
 *   @workspace/analytics            → the shared event catalog + types (this file)
 *   @workspace/analytics/browser    → posthog-js client (web)
 *   @workspace/analytics/server     → posthog-node client (api + worker)
 *   @workspace/analytics/extension  → fetch-based client (Chrome extension)
 */
export * from "./events.js"
export type { Platform, AnalyticsContext } from "./context.js"
