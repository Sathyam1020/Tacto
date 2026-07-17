import { ImageResponse } from "next/og"

/**
 * Dynamically generated Open Graph / Twitter card for the marketing home
 * (1200×630). Self-contained — no external fonts or images, so it renders
 * anywhere. Uses the cobalt brand + a dot field.
 */
export const alt = "Tacto — Guides that write themselves"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
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

        <div style={{ marginTop: 44, fontSize: 82, fontWeight: 700, letterSpacing: -2, lineHeight: 1.02, maxWidth: 900 }}>
          Guides that write themselves.
        </div>
        <div style={{ marginTop: 26, fontSize: 30, color: "rgba(255,255,255,0.8)", maxWidth: 820, lineHeight: 1.3 }}>
          Record any workflow once — Tacto turns it into a step-by-step guide, walkthrough, or help center.
        </div>

        <div style={{ marginTop: "auto", fontSize: 24, color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>
          tacto.fyi
        </div>
      </div>
    ),
    { ...size }
  )
}
