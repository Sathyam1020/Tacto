import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PublicFormView } from "@/components/public-form-view"
import { fetchPublicForm } from "@/lib/public-form"

/**
 * Public fillable form. Lives outside the (app) group — no sidebar/navbar.
 * 404s for unpublished or unknown forms.
 */
type Params = { params: Promise<{ shareId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { shareId } = await params
  const form = await fetchPublicForm(shareId)
  if (!form) return { title: "Form not found" }
  return {
    title: form.title,
    description: form.description ?? undefined,
    // Forms live inside their parent guide; the standalone page is a fill
    // endpoint, not a search destination. Keep it out of the index but let link
    // equity flow to the guide it belongs to.
    robots: { index: false, follow: true },
  }
}

export default async function PublicFormPage({ params }: Params) {
  const { shareId } = await params
  const form = await fetchPublicForm(shareId)
  if (!form) notFound()
  return <PublicFormView form={form} />
}
