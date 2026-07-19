import { ImageResponse } from "next/og"

/**
 * Shared Open Graph / Twitter card renderer for public content viewers
 * (guides, forms, showcases, help centers). 1200×630, self-contained — no
 * external fonts or images, so it renders anywhere. Matches the marketing OG
 * card: cobalt gradient, reticle logo, eyebrow, title, and a footer line.
 */
export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = "image/png"

export function renderOgImage({
  eyebrow,
  title,
  footer = "tacto.fyi",
}: {
  /** Small uppercase label, e.g. "Guide" or "Help center". */
  eyebrow?: string
  title: string
  /** Bottom-left line — usually the workspace/brand name, defaults to tacto.fyi. */
  footer?: string
}) {
  const trimmed = title.length > 120 ? `${title.slice(0, 117)}…` : title
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "88px",
          background: "radial-gradient(120% 120% at 50% -10%, #6b74dd 0%, #5058bf 45%, #3f469c 100%)",
          backgroundColor: "#5058bf",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "rgba(255,255,255,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 999, border: "4px solid white" }} />
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>Tacto</div>
        </div>

        {eyebrow ? (
          <div
            style={{
              marginTop: 44,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.72)",
            }}
          >
            {eyebrow}
          </div>
        ) : null}

        <div
          style={{
            marginTop: eyebrow ? 16 : 44,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.04,
            maxWidth: 1000,
            display: "flex",
          }}
        >
          {trimmed}
        </div>

        <div style={{ marginTop: "auto", fontSize: 24, color: "rgba(255,255,255,0.7)" }}>{footer}</div>
      </div>
    ),
    {
      ...OG_SIZE,
      // These routes are dynamic (per-share content), so cache the rendered PNG
      // at the CDN/scraper layer instead of re-rendering on every social scrape.
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  )
}
