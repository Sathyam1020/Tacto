"use client"

import * as React from "react"
import {
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  TRANSLATION_LANGUAGES,
  type RetranslateTarget,
} from "@workspace/contracts/guide"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { GeneratingState } from "@/components/generating-state"
import {
  useAddTranslation,
  useDeleteTranslation,
  useGuideTranslations,
  useRetranslate,
} from "@/lib/guides"

const NAME = new Map<string, string>(
  TRANSLATION_LANGUAGES.map((l) => [l.code, l.name])
)
const FLAG: Record<string, string> = {
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  pt: "🇵🇹",
  it: "🇮🇹",
  nl: "🇳🇱",
  ja: "🇯🇵",
  ko: "🇰🇷",
  zh: "🇨🇳",
  hi: "🇮🇳",
  ar: "🇸🇦",
  he: "🇮🇱",
}

/** Plain-text preview of a block's HTML content. */
function toText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

type Row = {
  id: string
  label: string
  original: string
  /** The block's stable key (title/summary rows have none). */
  blockKey?: string
}

/**
 * Translations — a per-block preview. Each block shows its original text and,
 * for every added language, the translated text. The "original" reflects the
 * editor's current DRAFT (unsaved edits included), and re-translate reads the
 * same draft — so an edited step can be re-translated immediately. Translations
 * publish to the reader's language switcher when the guide is Updated.
 */
export function TranslationsDialog({
  guideId,
  title,
  summary,
  blocks,
  open,
  onOpenChange,
  onDirty,
}: {
  guideId: string
  /** The editor's current draft title/summary/blocks (what's being edited). */
  title: string
  summary: string | null
  blocks: { key: string; type: string; content: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Mark the editor dirty — translations publish only when the guide is Updated. */
  onDirty: () => void
}) {
  const { data: translations } = useGuideTranslations(guideId)
  const add = useAddTranslation(guideId)
  const remove = useDeleteTranslation(guideId)
  const retranslate = useRetranslate(guideId)
  // Which (language, rowId) re-translate is in flight — for the row spinner.
  const [pendingRow, setPendingRow] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")

  const langs = translations ?? []
  const existing = new Set(langs.map((t) => t.language))
  const available = TRANSLATION_LANGUAGES.filter((l) => !existing.has(l.code))

  // The translatable rows: title, optional summary, then each block.
  const rows: Row[] = [
    { id: "__title__", label: "TITLE", original: title },
    ...(summary
      ? [
          {
            id: "__summary__",
            label: "DESCRIPTION",
            original: summary,
          } as Row,
        ]
      : []),
    ...blocks.map((b) => ({
      id: b.key,
      label: b.type,
      original: toText(b.content),
      blockKey: b.key,
    })),
  ]
  const shown = query
    ? rows.filter((r) => r.original.toLowerCase().includes(query.toLowerCase()))
    : rows

  /** The re-translate target a row maps to (title / summary / step). */
  function rowTarget(row: Row): RetranslateTarget {
    if (row.id === "__title__") return { kind: "title" }
    if (row.id === "__summary__") return { kind: "summary" }
    return { kind: "step", stepKey: row.blockKey! }
  }

  /** The translated text for a row in a given language (or null). */
  function translated(row: Row, t: (typeof langs)[number]): string | null {
    if (row.id === "__title__") return t.title
    if (row.id === "__summary__") return t.summary ?? null
    if (row.blockKey == null) return null
    const content = t.steps?.[row.blockKey]
    return content ? toText(content) : null
  }

  /** Whether a row's translation has drifted from the current guide. */
  function rowStale(row: Row, t: (typeof langs)[number]): boolean {
    if (row.id === "__title__") return t.staleness.titleStale
    if (row.id === "__summary__") return t.staleness.summaryStale
    if (row.blockKey == null) return false
    return (
      t.staleness.staleStepKeys.includes(row.blockKey) ||
      t.staleness.newStepKeys.includes(row.blockKey)
    )
  }

  function generate(code: string) {
    onDirty() // translation is a draft until the guide is Saved
    add.mutate(code, {
      onSuccess: () =>
        toast.success(`Translating to ${NAME.get(code) ?? code}…`),
      onError: () => toast.error("Couldn't start that translation"),
    })
  }

  /** Re-translate one row (title / summary / step) into one language. */
  function retranslateRow(language: string, row: Row) {
    const token = `${language}:${row.id}`
    setPendingRow(token)
    onDirty()
    retranslate.mutate(
      { language, target: rowTarget(row) },
      {
        onSuccess: () =>
          toast.success("Re-translated — Update guide to publish"),
        onError: () => toast.error("Couldn't re-translate that"),
        onSettled: () => setPendingRow(null),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg text-sm">
              文
            </span>
            Translations
          </DialogTitle>
        </DialogHeader>

        {/* FROM / TO language bar */}
        <div className="bg-muted/40 flex flex-wrap items-center gap-3 border-b px-6 py-3">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            From
          </span>
          <span className="bg-card flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium">
            🇬🇧 English
          </span>
          <span className="bg-border h-6 w-px" />
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            To
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {langs.map((t) => (
              <span
                key={t.language}
                className="bg-card flex items-center gap-2 rounded-full border py-1.5 pr-2 pl-3 text-sm font-medium"
              >
                <span>
                  {FLAG[t.language] ?? "🏳"} {NAME.get(t.language) ?? t.language}
                </span>
                {!t.published && (
                  <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Draft
                  </span>
                )}
                {t.staleness.stale && (
                  <span
                    title="The guide changed since this was translated — regenerate, or re-translate the flagged steps below"
                    className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400"
                  >
                    Outdated
                  </span>
                )}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        aria-label="Regenerate translation"
                        onClick={() => generate(t.language)}
                        disabled={t.status === "generating"}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                      />
                    }
                  >
                    {t.status === "generating" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Regenerate the whole translation
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        aria-label="Remove"
                        onClick={() => remove.mutate(t.language)}
                        disabled={remove.isPending}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                      />
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent side="top">Remove language</TooltipContent>
                </Tooltip>
              </span>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={add.isPending || available.length === 0}
                render={
                  <button className="text-muted-foreground hover:border-primary/50 hover:text-foreground flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm transition-colors disabled:opacity-40" />
                }
              >
                <Plus className="size-4" />
                Add Language
                <ChevronDown className="size-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-64 overflow-y-auto"
              >
                {available.map((l) => (
                  <DropdownMenuItem
                    key={l.code}
                    onClick={() => generate(l.code)}
                  >
                    <span className="mr-1">{FLAG[l.code]}</span>
                    {l.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="border-b px-6 py-3">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="pl-9"
            />
          </div>
        </div>

        {/* Per-block preview */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          {langs.some((t) => t.status === "generating") && (
            <div className="overflow-hidden rounded-xl border">
              <GeneratingState
                variant="translation"
                title={`Translating to ${langs
                  .filter((t) => t.status === "generating")
                  .map((t) => NAME.get(t.language) ?? t.language)
                  .join(", ")}…`}
                subtitle="Rewriting every step in the new language."
              />
            </div>
          )}
          {shown.map((row) => (
            <div key={row.id} className="overflow-hidden rounded-xl border">
              <div className="bg-muted/40 border-b px-4 py-2">
                <span className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
                  {row.label}
                </span>
              </div>
              <div className="space-y-4 p-4">
                <p className="bg-muted/40 text-foreground/90 rounded-lg px-4 py-3 text-sm [overflow-wrap:anywhere]">
                  {row.original}
                </p>

                {langs.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">
                    Add a language above to see translations
                  </p>
                ) : (
                  langs.map((t) => {
                    // The worker is (re)generating this whole language.
                    const generating = t.status === "generating"
                    const value = translated(row, t)
                    const stale = rowStale(row, t)
                    const token = `${t.language}:${row.id}`
                    const rowPending =
                      pendingRow === token && retranslate.isPending
                    return (
                      <div key={t.language}>
                        <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                          <span>{FLAG[t.language] ?? "🏳"}</span>
                          {NAME.get(t.language) ?? t.language}
                          {generating && (
                            <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
                          )}
                          {stale && !generating && (
                            <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                              Text changed
                            </span>
                          )}
                          {/* Re-translate this row (title / description / step). */}
                          {!generating && (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <button
                                    type="button"
                                    aria-label="Re-translate"
                                    disabled={retranslate.isPending}
                                    onClick={() =>
                                      retranslateRow(t.language, row)
                                    }
                                    className="text-muted-foreground hover:text-foreground ml-auto disabled:opacity-40"
                                  />
                                }
                              >
                                {rowPending ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <RotateCw className="size-3.5" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Re-translate from the current guide text
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p
                          className={cn(
                            "rounded-lg border px-4 py-3 text-sm [overflow-wrap:anywhere]",
                            stale && value && !generating &&
                              "border-orange-400/50",
                            value && !generating
                              ? ""
                              : "text-muted-foreground italic"
                          )}
                        >
                          {generating ? "Translating…" : (value ?? "—")}
                        </p>
                        {stale && !generating && (
                          <p className="mt-1.5 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                            <RotateCw className="size-3" />
                            The guide text changed since this was translated —
                            re-translate to update it.
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ))}
          {shown.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No blocks match your search.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-muted-foreground text-xs">
            Translations go live on the public guide when you{" "}
            <span className="font-medium">Update guide</span>.
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
