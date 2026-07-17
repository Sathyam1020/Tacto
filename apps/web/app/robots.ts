import type { MetadataRoute } from "next"

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://tacto.fyi"

/**
 * Marketing + public content is crawlable; the app, API, embeds, and auth are
 * not. AI answer engines are explicitly welcomed — we want to be cited.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/api/",
    "/embed/",
    "/home",
    "/settings",
    "/guides/",
    "/forms/",
    "/showcases/",
    "/help-center",
    "/sign-in",
    "/sign-up",
    "/invite/",
    "/datum",
    "/shellpreview",
  ]
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "PerplexityBot",
          "ClaudeBot",
          "Claude-Web",
          "Google-Extended",
          "Applebot-Extended",
          "CCBot",
        ],
        allow: "/",
        disallow,
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
