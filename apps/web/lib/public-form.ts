import type { FormDocument } from "@workspace/contracts/form"

export type PublicForm = {
  shareId: string
  title: string
  description: string | null
  document: FormDocument
  version: number
}

/** Server-side fetch of a published form by shareId (public, no auth). */
export async function fetchPublicForm(
  shareId: string
): Promise<PublicForm | null> {
  const base = process.env.API_URL ?? "http://localhost:4100"
  try {
    const res = await fetch(`${base}/api/public/forms/${shareId}`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { form: PublicForm }
    return data.form
  } catch {
    return null
  }
}
