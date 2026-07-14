import type { NextConfig } from "next"

/**
 * /api/* is proxied to the Express API so auth cookies stay first-party
 * (Safari ITP blocks third-party auth cookies — see better-auth docs).
 * API_URL defaults to the local dev server; set it per environment in prod.
 */
const API_URL = process.env.API_URL ?? "http://localhost:4100"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
