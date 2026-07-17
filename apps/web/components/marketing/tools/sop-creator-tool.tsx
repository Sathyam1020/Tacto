"use client"

import * as React from "react"
import { Check, Copy, Download, Plus, X } from "lucide-react"

const field =
  "mt-1.5 w-full rounded-xl border border-[var(--l-hairline-strong)] bg-white px-3.5 py-2.5 text-[14px] text-[var(--l-ink)] outline-none focus-visible:border-cobalt focus-visible:ring-2 focus-visible:ring-cobalt/30"
const label = "text-[13px] font-medium text-[var(--l-ink)]"

export function SopCreatorTool() {
  const [title, setTitle] = React.useState("")
  const [owner, setOwner] = React.useState("")
  const [purpose, setPurpose] = React.useState("")
  const [scope, setScope] = React.useState("")
  const [steps, setSteps] = React.useState<string[]>(["", "", ""])
  const [copied, setCopied] = React.useState(false)

  const setStep = (i: number, v: string) => setSteps((s) => s.map((x, j) => (j === i ? v : x)))
  const addStep = () => setSteps((s) => [...s, ""])
  const removeStep = (i: number) => setSteps((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s))

  const markdown = React.useMemo(() => {
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean)
    const lines: string[] = []
    lines.push(`# ${title.trim() || "Standard Operating Procedure"}`)
    lines.push("")
    if (owner.trim()) lines.push(`**Owner:** ${owner.trim()}  `)
    lines.push(`**Last updated:** ____`)
    lines.push("")
    lines.push("## Purpose")
    lines.push(purpose.trim() || "_Why this procedure exists and what it accomplishes._")
    lines.push("")
    lines.push("## Scope")
    lines.push(scope.trim() || "_When this applies and who it's for._")
    lines.push("")
    lines.push("## Procedure")
    if (cleanSteps.length) cleanSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
    else lines.push("1. _Add the first step._")
    lines.push("")
    return lines.join("\n")
  }, [title, owner, purpose, scope, steps])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — the download still works */
    }
  }

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${(title.trim() || "sop").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Form */}
      <div>
        <label className="block">
          <span className={label}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Publish the monthly report" className={field} />
        </label>
        <label className="mt-4 block">
          <span className={label}>Owner (optional)</span>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Finance team" className={field} />
        </label>
        <label className="mt-4 block">
          <span className={label}>Purpose</span>
          <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} placeholder="What this procedure accomplishes." className={`${field} resize-none`} />
        </label>
        <label className="mt-4 block">
          <span className={label}>Scope</span>
          <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={2} placeholder="When it applies and who it's for." className={`${field} resize-none`} />
        </label>

        <div className="mt-5">
          <span className={label}>Steps</span>
          <div className="mt-2 flex flex-col gap-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex size-7 flex-none items-center justify-center rounded-lg bg-primary/10 font-mono text-[12px] font-medium text-cobalt">{i + 1}</span>
                <input value={s} onChange={(e) => setStep(i, e.target.value)} placeholder={`Step ${i + 1}`} className="w-full rounded-xl border border-[var(--l-hairline-strong)] bg-white px-3 py-2 text-[14px] text-[var(--l-ink)] outline-none focus-visible:border-cobalt focus-visible:ring-2 focus-visible:ring-cobalt/30" />
                <button type="button" onClick={() => removeStep(i)} aria-label={`Remove step ${i + 1}`} className="flex size-8 flex-none items-center justify-center rounded-lg text-[var(--l-ink-tertiary)] transition-colors hover:bg-[var(--l-hover)] hover:text-[var(--l-ink)]">
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-cobalt hover:text-primary">
            <Plus className="size-4" /> Add step
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className={label}>Preview</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--l-hairline-strong)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--l-ink)] transition-colors hover:bg-[var(--l-hover)]">
              {copied ? <Check className="size-3.5 text-[var(--l-success)]" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-white transition-transform hover:scale-[1.02]">
              <Download className="size-3.5" /> .md
            </button>
          </div>
        </div>
        <pre className="mt-2 h-full max-h-[520px] overflow-auto rounded-2xl border border-[var(--l-hairline)] bg-[var(--l-canvas)] p-5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-[var(--l-ink)]">
          {markdown}
        </pre>
      </div>
    </div>
  )
}
