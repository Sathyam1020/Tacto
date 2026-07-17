"use client"

import * as React from "react"
import QRCode from "qrcode"
import { Download } from "lucide-react"

export function QrCodeTool() {
  const [text, setText] = React.useState("https://tacto.fyi")
  const [dark, setDark] = React.useState("#16181F")
  const [light, setLight] = React.useState("#FFFFFF")
  const [ec, setEc] = React.useState<"L" | "M" | "Q" | "H">("M")
  const [dataUrl, setDataUrl] = React.useState<string>("")
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const value = text.trim() || " "
    QRCode.toDataURL(value, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: ec,
      color: { dark, light },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't generate a QR code for that input.")
      })
    return () => {
      cancelled = true
    }
  }, [text, dark, light, ec])

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      {/* Controls */}
      <div className="order-2 md:order-1">
        <label className="block">
          <span className="text-[13px] font-medium text-[var(--l-ink)]">Link or text</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="https://example.com"
            className="mt-2 w-full resize-none rounded-xl border border-[var(--l-hairline-strong)] bg-white px-3.5 py-2.5 text-[14px] text-[var(--l-ink)] outline-none focus-visible:border-cobalt focus-visible:ring-2 focus-visible:ring-cobalt/30"
          />
        </label>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[13px] font-medium text-[var(--l-ink)]">Foreground</span>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--l-hairline-strong)] bg-white px-3 py-2">
              <input type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Foreground color" />
              <span className="font-mono text-[12.5px] text-[var(--l-ink-subtle)]">{dark.toUpperCase()}</span>
            </div>
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-[var(--l-ink)]">Background</span>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--l-hairline-strong)] bg-white px-3 py-2">
              <input type="color" value={light} onChange={(e) => setLight(e.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Background color" />
              <span className="font-mono text-[12.5px] text-[var(--l-ink-subtle)]">{light.toUpperCase()}</span>
            </div>
          </label>
        </div>

        <div className="mt-5">
          <span className="text-[13px] font-medium text-[var(--l-ink)]">Error correction</span>
          <div className="mt-2 inline-flex rounded-xl border border-[var(--l-hairline)] bg-[var(--l-canvas)] p-1">
            {(["L", "M", "Q", "H"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setEc(k)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  ec === k ? "bg-white text-cobalt shadow-sm" : "text-[var(--l-ink-subtle)] hover:text-[var(--l-ink)]"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[var(--l-ink-tertiary)]">Higher levels stay scannable even if the code is partly obscured.</p>
        </div>
      </div>

      {/* Preview */}
      <div className="order-1 flex flex-col items-center gap-4 md:order-2">
        <div className="flex aspect-square w-full max-w-[320px] items-center justify-center rounded-3xl border border-[var(--l-hairline)] bg-white p-6 shadow-sm">
          {error ? (
            <p className="text-center text-[13px] text-[var(--l-ink-tertiary)]">{error}</p>
          ) : dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="Generated QR code" className="h-full w-full" />
          ) : null}
        </div>
        <a
          href={dataUrl || "#"}
          download="tacto-qr-code.png"
          aria-disabled={!dataUrl || !!error}
          className="inline-flex w-full max-w-[320px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.01] aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <Download className="size-4" /> Download PNG
        </a>
      </div>
    </div>
  )
}
