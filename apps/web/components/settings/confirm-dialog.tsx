"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"

/**
 * A confirmation dialog. When `confirmText` is set, the confirm button stays
 * disabled until the user types it exactly — the guard for irreversible actions
 * (delete account/workspace). Without it, a plain confirm/cancel (e.g. leave).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmText,
  destructive = true,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  /** If set, the user must type this exactly to enable the confirm button. */
  confirmText?: string
  destructive?: boolean
  onConfirm: () => Promise<void> | void
}) {
  const [typed, setTyped] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) setTyped("")
  }, [open])

  const ready = !confirmText || typed.trim() === confirmText

  async function confirm() {
    if (!ready || busy) return
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{description}</DialogDescription>
        </DialogHeader>

        {confirmText && (
          <div className="space-y-1.5">
            <p className="text-[13px] text-muted-foreground">
              Type <span className="font-mono font-medium text-foreground">{confirmText}</span> to confirm.
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              autoComplete="off"
              aria-label="Confirmation text"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={confirm}
            disabled={!ready || busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
