"use client"

import * as React from "react"
import QRCode from "qrcode"
import { Download } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

/** A scannable QR for a public link, with a PNG download. Rendered on white so
 *  it scans regardless of the surrounding theme. */
export function QrCode({ value, filename = "guide-qr.png" }: { value: string; filename?: string }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => !cancelled && setDataUrl(url))
      .catch(() => !cancelled && setDataUrl(null))
    return () => {
      cancelled = true
    }
  }, [value])

  function download() {
    if (!dataUrl) return
    const a = document.createElement("a")
    a.href = dataUrl
    a.download = filename
    a.click()
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="rounded-xl border border-[var(--l-hairline)] bg-white p-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR code for the public link" className="size-40" />
        ) : (
          <div className="size-40 animate-pulse rounded bg-muted" />
        )}
      </div>
      <Button size="sm" variant="outline" onClick={download} disabled={!dataUrl}>
        <Download className="size-4" />
        Download PNG
      </Button>
    </div>
  )
}
