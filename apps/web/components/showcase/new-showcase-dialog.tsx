"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
import { Label } from "@workspace/ui/components/label"

import { useCreateShowcase } from "@/lib/showcase"

/** Names the showcase up-front, then creates it and opens the editor. */
export function NewShowcaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const create = useCreateShowcase()
  const [title, setTitle] = React.useState("")

  React.useEffect(() => {
    if (open) setTitle("")
  }, [open])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const name = title.trim()
    if (!name) return
    create.mutate(name, {
      onSuccess: (detail) => {
        onOpenChange(false)
        router.push(`/showcases/${detail.id}`)
      },
      onError: () => toast.error("Couldn't create the showcase"),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New showcase</DialogTitle>
          <DialogDescription>Give it a name — you can change it later.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sc-name">Name</Label>
            <Input
              id="sc-name"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Product tour"
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
