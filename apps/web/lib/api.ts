import axios from "axios"

/**
 * API client for non-auth endpoints (auth goes through lib/auth-client).
 * Same-origin /api is proxied to the Express API; cookies ride along
 * automatically.
 */
export const api = axios.create({
  baseURL: "/api",
})
