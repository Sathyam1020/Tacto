import { NextResponse } from "next/server"

/**
 * Same-origin image proxy for PDF export. Client `fetch()` of a cross-origin
 * R2 URL is blocked by CORS (unlike <img>), which tainted/failed the PDF
 * canvas. Fetching through our own origin removes the CORS dependency.
 *
 * SSRF guard: only proxies Cloudflare R2 hosts.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url")
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }
  if (!target.hostname.endsWith(".r2.cloudflarestorage.com")) {
    return NextResponse.json({ error: "Forbidden host" }, { status: 403 })
  }

  const upstream = await fetch(target.toString())
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 })
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "private, max-age=300",
    },
  })
}
