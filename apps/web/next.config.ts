import type { NextConfig } from "next"

/**
 * /api/* is proxied to the Express API so auth cookies stay first-party
 * (Safari ITP blocks third-party auth cookies — see better-auth docs).
 * API_URL defaults to the local dev server; set it per environment in prod.
 */
const API_URL = process.env.API_URL ?? "http://localhost:4100"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/analytics"],
  // PostHog ingestion is reverse-proxied through /ingest so ad-blockers can't
  // drop it and it stays first-party (same trick as /api). US region.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ]
  },
  /**
   * Framing policy. Embed routes must be iframable from ANY site (the whole
   * point of the embed foundation); everything else is locked to same-origin to
   * close the clickjacking hole (the app set no framing headers before). CSP
   * `frame-ancestors` supersedes `X-Frame-Options`, which can't express an
   * allowlist — so embed routes rely on the permissive CSP alone.
   */
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
      {
        // embed.js is a script tag (not framed); keep it lockable + cacheable.
        source: "/embed.js",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        // Everything EXCEPT the embed surfaces (negative lookahead) — otherwise
        // these headers would also stack onto /embed/* and block framing.
        source: "/((?!embed).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ]
  },
}

export default nextConfig
