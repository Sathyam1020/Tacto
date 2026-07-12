"use client"

import * as React from "react"
import { GripVertical } from "lucide-react"

import type { BlockType } from "@workspace/contracts/guide"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"

/** A block as the sort list needs it — identity, type, preview, thumbnail. */
export type SortRow = {
  key: string
  type: BlockType
  content: string
  screenshotUrl: string | null
}

const TYPE_LABEL: Record<Exclude<BlockType, "STEP">, string> = {
  HEADING: "Heading",
  TIP: "Tip",
  ALERT: "Alert",
  OUTCOME: "Outcome",
}

/** Plain-text preview of a block's HTML content. */
function preview(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return text || "Untitled"
}

/** Move the dragged keys (kept in their relative order) to `dropIndex`. */
function reorder(
  order: SortRow[],
  dragKeys: string[],
  dropIndex: number
): SortRow[] {
  const dragging = order.filter((o) => dragKeys.includes(o.key))
  const rest = order.filter((o) => !dragKeys.includes(o.key))
  const removedBefore = order
    .slice(0, dropIndex)
    .filter((o) => dragKeys.includes(o.key)).length
  const insertAt = dropIndex - removedBefore
  return [...rest.slice(0, insertAt), ...dragging, ...rest.slice(insertAt)]
}

/**
 * Sort steps — drag-to-reorder the guide's blocks. Click selects a row;
 * Shift-click extends a range and ⌘/Ctrl-click toggles, so a group can be
 * dragged together. Applies to the editor's working copy (saved with the
 * normal Save button).
 */
export function SortStepsDialog({
  rows,
  open,
  onOpenChange,
  onApply,
}: {
  rows: SortRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (orderedKeys: string[]) => void
}) {
  const [order, setOrder] = React.useState<SortRow[]>(rows)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [anchor, setAnchor] = React.useState<string | null>(null)
  const [dragKeys, setDragKeys] = React.useState<string[] | null>(null)
  const [dropIndex, setDropIndex] = React.useState<number | null>(null)

  // Reseed from the current editor state only when the dialog opens — not on
  // every parent re-render (which would wipe an in-progress drag/selection).
  // `rows` is recomputed each parent render, so keep the latest in a ref.
  const rowsRef = React.useRef(rows)
  React.useEffect(() => {
    rowsRef.current = rows
  })
  React.useEffect(() => {
    if (open) {
      setOrder(rowsRef.current)
      setSelected(new Set())
      setAnchor(null)
      setDragKeys(null)
      setDropIndex(null)
    }
  }, [open])

  const changed = order.some((o, i) => o.key !== rows[i]?.key)

  // Running step number for STEP rows.
  let stepNo = 0
  const numbered = order.map((row) => ({
    row,
    n: row.type === "STEP" ? ++stepNo : null,
  }))

  function selectRow(key: string, e: React.MouseEvent) {
    if (e.shiftKey && anchor) {
      const a = order.findIndex((o) => o.key === anchor)
      const b = order.findIndex((o) => o.key === key)
      const [lo, hi] = a < b ? [a, b] : [b, a]
      setSelected(new Set(order.slice(lo, hi + 1).map((o) => o.key)))
    } else if (e.metaKey || e.ctrlKey) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
      setAnchor(key)
    } else {
      setSelected(new Set([key]))
      setAnchor(key)
    }
  }

  function onDragStart(key: string) {
    // Drag the whole selection if the grabbed row is part of it; else just it.
    const keys = selected.has(key) ? [...selected] : [key]
    if (!selected.has(key)) {
      setSelected(new Set([key]))
      setAnchor(key)
    }
    setDragKeys(keys)
  }

  function onRowDragOver(index: number, e: React.DragEvent) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientY - rect.top > rect.height / 2
    setDropIndex(after ? index + 1 : index)
  }

  function onDrop() {
    if (dragKeys && dropIndex !== null) {
      setOrder((o) => reorder(o, dragKeys, dropIndex))
    }
    setDragKeys(null)
    setDropIndex(null)
  }

  function apply() {
    onApply(order.map((o) => o.key))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Sort steps
          </DialogTitle>
          <DialogDescription>
            Drag to reorder. Shift-click to select a range, then drag the group.
          </DialogDescription>
        </DialogHeader>

        <div
          className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          {numbered.map(({ row, n }, i) => {
            const isSelected = selected.has(row.key)
            const isDragging = dragKeys?.includes(row.key)
            return (
              <React.Fragment key={row.key}>
                {dropIndex === i && <DropLine />}
                <div
                  draggable
                  onDragStart={() => onDragStart(row.key)}
                  onDragEnd={() => {
                    setDragKeys(null)
                    setDropIndex(null)
                  }}
                  onDragOver={(e) => onRowDragOver(i, e)}
                  onClick={(e) => selectRow(row.key, e)}
                  className={cn(
                    "flex cursor-grab items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors select-none active:cursor-grabbing",
                    isSelected
                      ? "border-primary/60 bg-primary/5"
                      : "border-transparent hover:bg-muted/60",
                    isDragging && "opacity-40"
                  )}
                >
                  <GripVertical className="text-muted-foreground size-4 shrink-0" />
                  {n !== null ? (
                    <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium tabular-nums">
                      {n}
                    </span>
                  ) : (
                    <span className="text-muted-foreground bg-muted flex h-6 shrink-0 items-center rounded-full px-2 font-mono text-[10px] tracking-wide uppercase">
                      {TYPE_LABEL[row.type as Exclude<BlockType, "STEP">]}
                    </span>
                  )}
                  {row.screenshotUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.screenshotUrl}
                      alt=""
                      className="bg-muted h-9 w-14 shrink-0 rounded border object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {preview(row.content)}
                  </span>
                </div>
              </React.Fragment>
            )
          })}
          {dropIndex === order.length && <DropLine />}
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!changed}>
            Apply order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DropLine() {
  return <div className="bg-primary mx-2 my-0.5 h-0.5 rounded-full" />
}
