import {
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  type ImageUploadKind,
} from "@workspace/contracts/settings"

import { api } from "@/lib/api"

/**
 * Upload an avatar or workspace logo. Validates locally, asks the API for a
 * presigned PUT, uploads straight to R2, and returns the stable same-origin
 * proxy URL (`/api/img/{key}`) to store on the user/organization.
 */
export async function uploadImage(file: File, kind: ImageUploadKind): Promise<string> {
  const contentType = file.type
  if (!(IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    throw new Error("Use a PNG, JPG, or WebP image")
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be under 2 MB")
  }
  const { data } = await api.post<{ key: string; uploadUrl: string; url: string }>(
    "/uploads/image",
    { kind, contentType }
  )
  const put = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: file,
  })
  if (!put.ok) throw new Error("Upload failed — try again")
  return data.url
}

/** Human-friendly name from a user record, falling back to the email. */
export function displayName(user: { name?: string | null; email?: string | null }): string {
  return user.name?.trim() || user.email?.trim() || "You"
}

/** First initial for an avatar fallback. */
export function initialOf(user: { name?: string | null; email?: string | null }): string {
  return (user.name || user.email || "?").charAt(0).toUpperCase()
}
