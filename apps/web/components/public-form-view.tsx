"use client"

import * as React from "react"
import { ArrowLeft, Check, Loader2 } from "lucide-react"

import {
  resolveFormDesign,
  validateSubmission,
  type FormDesign,
  type FormDocument,
} from "@workspace/contracts/form"
import { guideFontFamily } from "@/lib/guide-fonts"

import { FormFieldView } from "@/components/form-builder/form-field-view"
import type { PublicForm } from "@/lib/public-form"

/** Persistent anonymous id (shared with guide feedback). */
function useAnonId(): string | null {
  const [id, setId] = React.useState<string | null>(null)
  React.useEffect(() => {
    try {
      let v = localStorage.getItem("tacto_anon_id")
      if (!v) {
        v = crypto.randomUUID()
        localStorage.setItem("tacto_anon_id", v)
      }
      setId(v)
    } catch {
      /* private mode — submit anonymously */
    }
  }, [])
  return id
}

/**
 * The public, one-question-at-a-time form fill. Reused both standalone (at
 * /f/[shareId]) and, in Phase 7, inside a guide overlay (pass `embedGuideId` +
 * `onComplete`).
 */
export function PublicFormView({
  form,
  previewDoc,
  embedGuideId,
  embedded,
  onComplete,
}: {
  form?: PublicForm
  /** Preview an in-progress draft (from the builder) — no start/submit network. */
  previewDoc?: FormDocument
  embedGuideId?: string
  /** Rendered inside a guide overlay — fits the container instead of the viewport. */
  embedded?: boolean
  onComplete?: () => void
}) {
  const preview = previewDoc != null
  const minH = embedded ? "min-h-[360px]" : "min-h-svh"
  const doc: FormDocument = previewDoc ?? form!.document
  const design = resolveFormDesign(doc.design)
  const fields = doc.fields
  const anonId = useAnonId()

  const [index, setIndex] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const startedAt = React.useRef(Date.now())
  const beaconSent = React.useRef(false)

  React.useEffect(() => {
    if (preview || !form || beaconSent.current) return
    beaconSent.current = true
    void fetch(`/api/public/forms/${form.shareId}/start`, { method: "POST" }).catch(
      () => {}
    )
  }, [preview, form])

  const fontFamily = guideFontFamily(design.font)

  if (!doc.settings.acceptingSubmissions) {
    return (
      <Centered design={design} fontFamily={fontFamily} minH={minH}>
        <p className="text-lg" style={{ color: design.question }}>
          {doc.settings.closedMessage}
        </p>
      </Centered>
    )
  }

  if (done) {
    return (
      <Centered design={design} fontFamily={fontFamily} minH={minH}>
        <div
          className="flex size-14 items-center justify-center rounded-full"
          style={{ background: `${design.button}1f`, color: design.button }}
        >
          <Check className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold" style={{ color: design.question }}>
          {doc.thankYou.title}
        </h1>
        {doc.thankYou.description && (
          <p className="mt-2 max-w-md text-center" style={{ color: `${design.question}b3` }}>
            {doc.thankYou.description}
          </p>
        )}
      </Centered>
    )
  }

  if (fields.length === 0) {
    return (
      <Centered design={design} fontFamily={fontFamily} minH={minH}>
        <p style={{ color: `${design.question}b3` }}>This form has no questions yet.</p>
      </Centered>
    )
  }

  const field = fields[index]!
  const isLast = index === fields.length - 1

  function setAnswer(value: unknown) {
    setAnswers((a) => ({ ...a, [field.key]: value }))
    setError(null)
  }

  function validateCurrent(): boolean {
    if (field.type === "statement") return true
    const errs = validateSubmission([field], { [field.key]: answers[field.key] })
    if (errs.length > 0) {
      setError(errs[0]!.message)
      return false
    }
    return true
  }

  async function submit() {
    // In preview we don't persist — just show the thank-you screen.
    if (preview || !form) {
      setDone(true)
      onComplete?.()
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/forms/${form.shareId}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          anonId,
          answers,
          durationMs: Date.now() - startedAt.current,
          formVersion: form.version,
          metadata: embedGuideId ? { guideId: embedGuideId } : null,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { errors?: { message: string }[] }
        } | null
        setError(data?.error?.errors?.[0]?.message ?? "Couldn't submit — try again.")
        setSubmitting(false)
        return
      }
      if (doc.settings.redirectUrl) {
        window.location.href = doc.settings.redirectUrl
        return
      }
      setDone(true)
      onComplete?.()
    } catch {
      setError("Couldn't submit — check your connection.")
      setSubmitting(false)
    }
  }

  function next() {
    if (!validateCurrent()) return
    if (isLast) {
      void submit()
      return
    }
    setIndex((i) => i + 1)
    setError(null)
  }

  const progress = Math.round(((index + 1) / fields.length) * 100)

  return (
    <div
      className={`flex ${minH} flex-col`}
      style={{ background: design.background, fontFamily }}
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          !(e.target instanceof HTMLTextAreaElement) &&
          field.type !== "long_text"
        ) {
          e.preventDefault()
          next()
        }
      }}
    >
      {doc.settings.showProgressBar && (
        <div className="h-1 w-full" style={{ background: `${design.button}22` }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: design.button }}
          />
        </div>
      )}

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-xl flex-col gap-6">
          <FormFieldView
            key={field.key}
            field={field}
            value={answers[field.key]}
            onChange={setAnswer}
            design={design}
            autoFocus
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center gap-3">
            {index > 0 && (
              <button
                onClick={() => {
                  setIndex((i) => i - 1)
                  setError(null)
                }}
                className="flex size-10 items-center justify-center rounded-lg border transition-colors hover:bg-black/5"
                style={{ borderColor: `${design.answer}33`, color: design.answer }}
                aria-label="Back"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <button
              onClick={next}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-base font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: design.button, color: design.buttonText }}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {field.type === "statement"
                ? field.config.buttonText || "Continue"
                : isLast
                  ? "Submit"
                  : "OK"}
            </button>
            {!isLast && field.type !== "statement" && (
              <span className="text-xs" style={{ color: `${design.question}80` }}>
                press Enter ↵
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Centered({
  children,
  design,
  fontFamily,
  minH,
}: {
  children: React.ReactNode
  design: FormDesign
  fontFamily: string
  minH: string
}) {
  return (
    <div
      className={`flex ${minH} flex-col items-center justify-center px-6 text-center`}
      style={{ background: design.background, fontFamily }}
    >
      {children}
    </div>
  )
}
