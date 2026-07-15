"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"

import { useLibraryViewState } from "@/components/app-shell/view-context"
import { useCreateForm } from "@/lib/forms"

/**
 * Create a blank form from a name + description, then open the builder. Forms
 * created while viewing a folder land in that folder (else the default).
 */
export function CreateFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const create = useCreateForm()
  const { view } = useLibraryViewState()

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")

  // Reset the form when the dialog opens (render-time, no cascading effect).
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTitle("")
      setDescription("")
    }
  }

  const canCreate = title.trim().length > 0 && !create.isPending

  function submit() {
    if (!canCreate) return
    const folderId = view.type === "folder" ? view.id : undefined
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        folderId,
      },
      {
        onSuccess: (form) => {
          onOpenChange(false)
          router.push(`/forms/${form.id}/edit`)
        },
        onError: () => toast.error("Couldn't create the form"),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            New form
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Name</span>
            <Input
              value={title}
              autoFocus
              placeholder="Customer feedback"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </span>
            <Textarea
              value={description}
              rows={3}
              placeholder="What is this form for?"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canCreate} onClick={submit}>
            Create form
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
