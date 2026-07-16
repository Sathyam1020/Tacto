"use client"

import * as React from "react"
import { Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import type { ImageUploadKind } from "@workspace/contracts/settings"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { uploadImage } from "@/lib/settings"

/**
 * Avatar / workspace-logo uploader. Drag-and-drop or click to pick; replace or
 * remove an existing image. Uploads straight to R2 (presigned) and hands the
 * caller the stable proxy URL. Cropping is intentionally out of scope for now —
 * the square/circle preview leaves room to add it later without an API change.
 */
export function ImageUpload({
  value,
  onChange,
  kind,
  shape = "square",
  fallback,
  disabled,
}: {
  value: string | null
  onChange: (url: string | null) => void | Promise<void>
  kind: ImageUploadKind
  shape?: "circle" | "square"
  /** Shown when there's no image (initials or a mark). */
  fallback?: React.ReactNode
  disabled?: boolean
}) {
  const [busy, setBusy] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = React.useCallback(
    async (file: File | undefined) => {
      if (!file || disabled) return
      setBusy(true)
      try {
        const url = await uploadImage(file, kind)
        await onChange(url)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed")
      } finally {
        setBusy(false)
      }
    },
    [disabled, kind, onChange]
  )

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handleFile(e.dataTransfer.files?.[0])
        }}
        aria-label={value ? "Replace image" : "Upload image"}
        className={cn(
          "group relative flex size-16 flex-none items-center justify-center overflow-hidden border border-[var(--l-hairline)] bg-[var(--l-card)] transition-colors",
          shape === "circle" ? "rounded-full" : "rounded-xl",
          dragging && "border-primary ring-2 ring-primary/30",
          !disabled && "hover:border-primary/50"
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-muted-foreground">{fallback ?? <Upload className="size-5" />}</span>
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="size-5 animate-spin text-white" />
          </span>
        ) : (
          !disabled && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Upload className="size-5 text-white" />
            </span>
          )
        )}
      </button>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {value ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || busy}
              onClick={() => void onChange(null)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground">PNG, JPG, or WebP · up to 2 MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
    </div>
  )
}
