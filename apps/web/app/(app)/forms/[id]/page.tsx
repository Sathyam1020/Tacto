"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Download, Eye, SquarePen } from "lucide-react"

import { resolveFormDesign, type FormField } from "@workspace/contracts/form"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { FormFieldView } from "@/components/form-builder/form-field-view"
import { TrendChart } from "@/components/analytics/trend-chart"
import { useSetNavbar } from "@/components/navbar-context"
import { authClient } from "@/lib/auth-client"
import {
  useForm,
  useFormAnalytics,
  useFormSubmissions,
  useFormSummary,
} from "@/lib/forms"

type Tab = "form" | "submissions" | "summary" | "analytics"

export default function FormDetailPage() {
  const params = useParams<{ id: string }>()
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: form } = useForm(activeWorkspace?.id, params.id)
  const [tab, setTab] = React.useState<Tab>("form")

  // Back to the library + Edit + View the live form. Publishing lives only in
  // the editor — this page is the form's home, and Edit is its way in.
  useSetNavbar(
    {
      leftActions: (
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/forms" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <h1 className="truncate text-[15px] font-semibold">
            {form?.title ?? "Form"}
          </h1>
        </div>
      ),
      actions: (
        <div className="flex items-center gap-2">
          {form?.shareId && (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/f/${form.shareId}`} target="_blank" />}
            >
              <Eye className="size-4" />
              View
            </Button>
          )}
          <Button
            size="sm"
            render={<Link href={`/forms/${params.id}/edit`} />}
          >
            <SquarePen className="size-4" />
            Edit
          </Button>
        </div>
      ),
    },
    [form?.title, form?.shareId, params.id]
  )

  if (!form) {
    return <div className="h-40 animate-pulse rounded-xl border" />
  }

  const fields = (form.published?.fields ?? []).filter((f) => f.type !== "statement")

  return (
    <div className="mx-auto max-w-4xl">
      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b">
        {(
          [
            ["form", "Form"],
            ["submissions", "Submissions"],
            ["summary", "Summary"],
            ["analytics", "Analytics"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "form" && <FormPreview form={form} />}
      {tab === "submissions" && <SubmissionsTab formId={params.id} fields={fields} />}
      {tab === "summary" && <SummaryTab formId={params.id} />}
      {tab === "analytics" && <AnalyticsTab formId={params.id} />}
    </div>
  )
}

function FormPreview({ form }: { form: NonNullable<ReturnType<typeof useForm>["data"]> }) {
  const doc = form.published
  if (!doc || doc.fields.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        This form isn’t published yet, or has no fields. Open the editor to build it.
      </p>
    )
  }
  const design = resolveFormDesign(doc.design)
  return (
    <div
      className="flex flex-col gap-10 rounded-xl border p-8"
      style={{ background: design.background }}
    >
      {doc.fields.map((field) => (
        <FormFieldView key={field.key} field={field} value={undefined} design={design} />
      ))}
    </div>
  )
}

function renderAnswer(field: FormField, value: unknown): string {
  if (value == null || value === "") return "—"
  if (Array.isArray(value)) {
    return value
      .map((k) => field.config.options.find((o) => o.key === k)?.label ?? String(k))
      .join(", ")
  }
  if (field.type === "single_select" || field.type === "dropdown") {
    return field.config.options.find((o) => o.key === value)?.label ?? String(value)
  }
  return String(value)
}

function SubmissionsTab({ formId, fields }: { formId: string; fields: FormField[] }) {
  const { data, isPending } = useFormSubmissions(formId)
  if (isPending) return <div className="h-40 animate-pulse rounded-xl border" />
  const rows = data?.submissions ?? []
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        No responses yet.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" render={<a href={`/api/forms/${formId}/submissions/export`} />}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">Submitted</th>
              {fields.map((f) => (
                <th key={f.key} className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
                  {f.title || f.type}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {new Date(s.createdAt).toLocaleString()}
                </td>
                {fields.map((f) => (
                  <td key={f.key} className="max-w-xs truncate px-3 py-2">
                    {renderAnswer(f, s.answers[f.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryTab({ formId }: { formId: string }) {
  const { data, isPending } = useFormSummary(formId)
  if (isPending) return <div className="h-40 animate-pulse rounded-xl border" />
  const summary = data?.summary ?? []
  if (summary.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        No questions to summarize yet.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {summary.map((s) => (
        <div key={s.key} className="rounded-xl border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-medium">{s.title}</h3>
            <span className="text-xs text-muted-foreground">{s.responses} responses</span>
          </div>
          {s.options && (
            <div className="mt-3 flex flex-col gap-2">
              {s.options.map((o) => {
                const total = s.options!.reduce((a, b) => a + b.count, 0) || 1
                const pct = Math.round((o.count / total) * 100)
                return (
                  <div key={o.label} className="flex items-center gap-3 text-sm">
                    <span className="w-40 truncate">{o.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-muted-foreground tabular-nums">
                      {o.count}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {s.average != null && (
            <p className="mt-2 text-sm text-muted-foreground">
              Average <span className="font-medium text-foreground">{s.average}</span> · min {s.min} · max {s.max}
            </p>
          )}
          {s.samples && (
            <ul className="mt-2 flex flex-col gap-1">
              {s.samples.map((v, i) => (
                <li key={i} className="truncate rounded-md bg-muted/50 px-2 py-1 text-sm">
                  {v}
                </li>
              ))}
              {s.samples.length === 0 && (
                <li className="text-sm text-muted-foreground">No answers yet.</li>
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function AnalyticsTab({ formId }: { formId: string }) {
  const [range, setRange] = React.useState<"7d" | "30d" | "90d">("30d")
  const { data, isPending } = useFormAnalytics(formId, range)

  const cards = [
    { label: "Views", value: data?.views ?? 0 },
    { label: "Starts", value: data?.starts ?? 0 },
    { label: "Submissions", value: data?.submissions ?? 0 },
    { label: "Completion rate", value: `${data?.completionRate ?? 0}%` },
    { label: "Avg. time", value: formatMs(data?.avgCompletionMs ?? null) },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">Submissions over time</h3>
          <div className="flex gap-1">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium",
                  range === r ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {isPending || !data ? (
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        ) : (
          <TrendChart data={data.trend} ariaLabel="Submissions over time" />
        )}
      </div>
    </div>
  )
}
