import type { CaptureEvent } from "@workspace/contracts/capture"

/** Bearer API client for the capture flow. Called from the background SW. */

const API_BASE = import.meta.env.WXT_API_BASE as string
export const APP_URL = import.meta.env.WXT_APP_URL as string

async function authed<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null
    const err = new Error(
      body?.error?.message ?? `Request failed (${res.status})`
    ) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

export function fetchMe(token: string) {
  return authed<{
    user: { name: string; email: string }
    workspace: { id: string; name: string }
  }>(token, "/api/extension/me")
}

export function createCapture(
  token: string,
  title?: string,
  folderId?: string | null
) {
  return authed<{ captureId: string }>(token, "/api/captures/extension", {
    method: "POST",
    body: JSON.stringify({ title, folderId: folderId ?? null }),
  })
}

export function getScreenshotUrls(
  token: string,
  captureId: string,
  count: number
) {
  return authed<{ urls: { key: string; uploadUrl: string }[] }>(
    token,
    `/api/captures/${captureId}/screenshot-urls`,
    { method: "POST", body: JSON.stringify({ count }) }
  )
}

export function submitCapture(
  token: string,
  captureId: string,
  events: CaptureEvent[]
) {
  return authed<{ capture: { id: string; status: string } }>(
    token,
    `/api/captures/${captureId}/submit`,
    { method: "POST", body: JSON.stringify({ events }) }
  )
}

/** Upload one screenshot dataURL to its presigned R2 URL. */
export async function uploadShot(uploadUrl: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob()
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: blob,
  })
  if (!res.ok) throw new Error(`Screenshot upload failed (${res.status})`)
}
