import { headers } from "next/headers"

/**
 * Absolute canonical URL for the CURRENT request host — not a baked-in
 * tacto.fyi. Help centers can run on customer domains, so the canonical must
 * point at whatever domain is actually serving the page. Only safe to call from
 * dynamic (non-statically-generated) routes, since it reads request headers.
 */
export async function canonicalUrl(path: string): Promise<string> {
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tacto.fyi").host
  return `${proto}://${host}${path}`
}
