"use client"

import * as React from "react"
import {
  HelpCircle,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import type { Faq } from "@workspace/contracts/guide"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { useGenerateFaqs } from "@/lib/faqs"

const MAX_AI_FAQS = 5 // the AI authors at most this many per guide
const MAX_FAQS = 20 // total cap (AI + user) — matches the contract

/**
 * FAQ editor — the bottom section of the guide editor. FAQs live in the draft
 * document (autosaved + published like slides); every change flows out through
 * `onChange`. Generate replaces AI FAQs and preserves user ones; editing an AI
 * FAQ promotes it to user-owned so it's never auto-replaced.
 */
export function FaqSection({
  guideId,
  faqs,
  onChange,
}: {
  guideId: string
  faqs: Faq[]
  onChange: (faqs: Faq[]) => void
}) {
  const generate = useGenerateFaqs(guideId)
  const [addOpen, setAddOpen] = React.useState(false)
  const [regenIndex, setRegenIndex] = React.useState<number | null>(null)

  // An AI FAQ stays counted as AI even after editing (it still consumed one of
  // the 5 AI slots). Users add their own on top.
  const aiCount = faqs.filter((f) => f.source === "ai").length
  const busy = generate.isPending
  // Fill the remaining AI slots, bounded by the total cap.
  const genCount = Math.min(MAX_AI_FAQS - aiCount, MAX_FAQS - faqs.length)
  const canGenerate = !busy && genCount > 0
  const canAdd = faqs.length < MAX_FAQS

  function handleGenerate() {
    if (!canGenerate) return
    generate.mutate(
      // Append new AI FAQs, avoiding every existing question.
      { count: genCount, avoid: faqs.map((f) => f.question) },
      {
        onSuccess: (aiFaqs) => {
          if (aiFaqs.length === 0) {
            toast.error("Couldn't generate FAQs for this guide")
            return
          }
          onChange([...faqs, ...aiFaqs])
          toast.success(`Generated ${aiFaqs.length} FAQ${aiFaqs.length === 1 ? "" : "s"}`)
        },
        onError: () => toast.error("Couldn't generate FAQs"),
      }
    )
  }

  function handleRegenerate(index: number) {
    if (busy) return
    setRegenIndex(index)
    const avoid = faqs.filter((_, i) => i !== index).map((f) => f.question)
    generate.mutate(
      { count: 1, avoid },
      {
        onSuccess: (aiFaqs) => {
          setRegenIndex(null)
          const fresh = aiFaqs[0]
          if (!fresh) {
            toast.error("Couldn't regenerate this FAQ")
            return
          }
          const next = faqs.slice()
          next[index] = fresh
          onChange(next)
        },
        onError: () => {
          setRegenIndex(null)
          toast.error("Couldn't regenerate this FAQ")
        },
      }
    )
  }

  function updateFaq(index: number, patch: Partial<Faq>) {
    const next = faqs.slice()
    // Keep the source: an edited AI FAQ still counts as one of the 5 AI FAQs,
    // and generation only appends (never overwrites), so edits are safe.
    next[index] = { ...next[index]!, ...patch }
    onChange(next)
  }

  function deleteFaq(index: number) {
    onChange(faqs.filter((_, i) => i !== index))
  }

  function addFaq(question: string, answer: string) {
    onChange([...faqs, { question, answer, source: "user" }])
    setAddOpen(false)
  }

  return (
    <section className="mt-16 border-t pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
            <HelpCircle className="size-4" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">FAQ</h2>
            <p className="text-muted-foreground text-xs">
              Questions readers ask after the guide. {aiCount}/{MAX_AI_FAQS}{" "}
              AI-generated, plus your own.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={!canGenerate}
            title={
              aiCount >= MAX_AI_FAQS
                ? `The AI generates up to ${MAX_AI_FAQS} FAQs — delete or regenerate one to refresh`
                : undefined
            }
          >
            {busy && regenIndex === null ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate FAQ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={!canAdd}
            title={!canAdd ? `Maximum of ${MAX_FAQS} FAQs` : undefined}
          >
            <Plus className="size-4" />
            Add FAQ
          </Button>
        </div>
      </div>

      {faqs.length === 0 ? (
        <p className="text-muted-foreground mt-6 rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          No FAQs yet. Generate them from your steps, or add your own.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <FaqCard
              key={i}
              faq={faq}
              regenerating={regenIndex === i}
              onUpdate={(patch) => updateFaq(i, patch)}
              onRegenerate={() => handleRegenerate(i)}
              onDelete={() => deleteFaq(i)}
            />
          ))}
        </ul>
      )}

      <AddFaqDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addFaq} />
    </section>
  )
}

/** One editable FAQ row (blur-committed question + answer). */
function FaqCard({
  faq,
  regenerating,
  onUpdate,
  onRegenerate,
  onDelete,
}: {
  faq: Faq
  regenerating: boolean
  onUpdate: (patch: Partial<Faq>) => void
  onRegenerate: () => void
  onDelete: () => void
}) {
  return (
    <li
      className={cn(
        "bg-card rounded-lg border p-4 transition-opacity",
        regenerating && "pointer-events-none opacity-50"
      )}
    >
      <div className="flex items-start gap-2">
        <BlurField
          value={faq.question}
          onCommit={(v) => v && onUpdate({ question: v })}
          placeholder="Question"
          className="flex-1 font-medium"
        />
        <span className="text-muted-foreground mt-1.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
          {faq.source === "ai" ? "AI" : "You"}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="FAQ actions"
                disabled={regenerating}
              />
            }
          >
            {regenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {faq.source === "ai" && (
              <DropdownMenuItem onClick={onRegenerate}>
                <RefreshCw className="size-4" />
                Regenerate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <BlurField
        value={faq.answer}
        onCommit={(v) => v && onUpdate({ answer: v })}
        placeholder="Answer"
        multiline
        className="text-muted-foreground mt-2"
      />
    </li>
  )
}

/** Local-state field that commits its trimmed value on blur (if changed). Syncs
 *  when the external value changes (e.g. a Regenerate replaces the text). */
function BlurField({
  value,
  onCommit,
  multiline,
  className,
  placeholder,
}: {
  value: string
  onCommit: (value: string) => void
  multiline?: boolean
  className?: string
  placeholder?: string
}) {
  const [local, setLocal] = React.useState(value)
  // Sync to an external change (e.g. Regenerate) by adjusting state during
  // render — avoids a cascading effect and any flicker.
  const [lastValue, setLastValue] = React.useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setLocal(value)
  }
  const commit = () => {
    const trimmed = local.trim()
    if (trimmed !== value) onCommit(trimmed)
  }
  if (multiline) {
    return (
      <Textarea
        value={local}
        rows={2}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        className={cn("resize-none [field-sizing:content]", className)}
      />
    )
  }
  return (
    <Input
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      className={cn("border-transparent px-2 hover:border-input", className)}
    />
  )
}

/** Modal for adding a manual FAQ (question + answer). */
function AddFaqDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (question: string, answer: string) => void
}) {
  const [question, setQuestion] = React.useState("")
  const [answer, setAnswer] = React.useState("")

  // Reset the form when the dialog transitions to open (during render).
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuestion("")
      setAnswer("")
    }
  }

  const canAdd = question.trim().length > 0 && answer.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Add FAQ
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Question</span>
            <Input
              value={question}
              autoFocus
              placeholder="What happens after publishing?"
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Answer</span>
            <Textarea
              value={answer}
              rows={4}
              placeholder="Your guide goes live and becomes shareable."
              onChange={(e) => setAnswer(e.target.value)}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canAdd}
            onClick={() => onAdd(question.trim(), answer.trim())}
          >
            Add FAQ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
