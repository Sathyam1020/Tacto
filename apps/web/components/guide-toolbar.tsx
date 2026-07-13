"use client"

import * as React from "react"
import {
  Download,
  Languages,
  ListOrdered,
  Mic,
  Palette,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"

import type { GuideCustomization } from "@workspace/contracts/guide"

import { CustomizeGuideDialog } from "@/components/customize-guide-dialog"
import {
  ImportStepsDialog,
  type ImportedBlock,
} from "@/components/import-steps-dialog"
import { SortStepsDialog, type SortRow } from "@/components/sort-steps-dialog"
import { TranslationsDialog } from "@/components/translations-dialog"
import type { GuideDetail } from "@/lib/guides"

/**
 * Floating actions bar shown below the navbar on the guide editor — the home
 * of the guide-authoring tools (Guidejar-style).
 */
export function GuideToolbar({
  guide,
  customization,
  onCustomizationChange,
  sortRows,
  draftTitle,
  draftSummary,
  onReorder,
  onImport,
  onDirty,
  onExport,
}: {
  guide: GuideDetail
  /** The editor's working-copy customization (previewed live). */
  customization: GuideCustomization
  /** Stage customization into the editor's working copy (applied on Update). */
  onCustomizationChange: (next: GuideCustomization) => void
  /** The editor's current blocks, for the Sort steps + Translations dialogs. */
  sortRows: SortRow[]
  /** The editor's current draft title/summary — so Translations reflects edits. */
  draftTitle: string
  draftSummary: string | null
  /** Persist a new block order (by key) into the editor's working copy. */
  onReorder: (orderedKeys: string[]) => void
  /** Append imported blocks into the editor's working copy (applied on Update). */
  onImport: (blocks: ImportedBlock[]) => void
  /** Mark the editor dirty (e.g. a translation was generated). */
  onDirty: () => void
  /** Export the current draft to PDF (reflects unsaved edits). */
  onExport: () => void
}) {
  const [customizeOpen, setCustomizeOpen] = React.useState(false)
  const [sortOpen, setSortOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [translateOpen, setTranslateOpen] = React.useState(false)

  const soon = (name: string) => toast.info(`${name} — coming soon`)

  const items = [
    {
      icon: Palette,
      label: "Customize Guide",
      onClick: () => setCustomizeOpen(true),
    },
    {
      icon: Languages,
      label: "Add translations",
      onClick: () => setTranslateOpen(true),
    },
    { icon: Mic, label: "Add voiceovers", onClick: () => soon("Voiceovers") },
    {
      icon: Upload,
      label: "Import Steps",
      onClick: () => setImportOpen(true),
    },
    {
      icon: ListOrdered,
      label: "Sort steps",
      onClick: () => setSortOpen(true),
    },
    {
      icon: Download,
      label: "Export Guide",
      onClick: onExport,
    },
  ]

  return (
    <>
      <div className="mb-8 flex justify-center">
        <nav className="flex flex-wrap items-center justify-center gap-1 rounded-2xl border bg-card px-1 py-1 shadow-sm">
          {items.map((it) => (
            <Button
              key={it.label}
              variant="ghost"
              onClick={it.onClick}
              className="gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-foreground/80 hover:text-foreground"
            >
              <it.icon className="size-[18px]" strokeWidth={1.75} />
              {it.label}
            </Button>
          ))}
        </nav>
      </div>

      <CustomizeGuideDialog
        guideId={guide.id}
        value={customization}
        onApply={onCustomizationChange}
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
      />

      <SortStepsDialog
        rows={sortRows}
        open={sortOpen}
        onOpenChange={setSortOpen}
        onApply={onReorder}
      />

      <ImportStepsDialog
        currentGuideId={guide.id}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={onImport}
      />

      <TranslationsDialog
        guideId={guide.id}
        title={draftTitle}
        summary={draftSummary}
        blocks={sortRows}
        open={translateOpen}
        onOpenChange={setTranslateOpen}
        onDirty={onDirty}
      />
    </>
  )
}
