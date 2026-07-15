"use client"

import * as React from "react"

import { guideFontSchema } from "@workspace/contracts/guide"
import type { FormDesign } from "@workspace/contracts/form"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

const FONTS = guideFontSchema.options

/** Right-panel form design editor — colors, font, alignment. Every change flows
 *  through `onChange` into the builder's autosaved draft. */
export function DesignPanel({
  design,
  onChange,
}: {
  design: FormDesign
  onChange: (next: FormDesign) => void
}) {
  const set = (p: Partial<FormDesign>) => onChange({ ...design, ...p })

  return (
    <div className="flex flex-col gap-5">
      <ColorRow label="Background" value={design.background} onChange={(v) => set({ background: v })} />
      <ColorRow label="Question" value={design.question} onChange={(v) => set({ question: v })} />
      <ColorRow label="Answer" value={design.answer} onChange={(v) => set({ answer: v })} />
      <ColorRow label="Button" value={design.button} onChange={(v) => set({ button: v })} />
      <ColorRow label="Button text" value={design.buttonText} onChange={(v) => set({ buttonText: v })} />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Font</span>
        <Select
          value={design.font}
          onValueChange={(v) => set({ font: (v ?? design.font) as FormDesign["font"] })}
        >
          <SelectTrigger aria-label="Font">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Alignment</span>
        <div className="grid grid-cols-2 gap-2">
          {(["left", "center"] as const).map((a) => (
            <button
              key={a}
              onClick={() => set({ align: a })}
              className={`h-9 rounded-lg border text-sm capitalize transition-colors ${
                design.align === a
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input hover:bg-muted"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-24 font-mono text-xs"
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} color`}
          className="size-8 flex-none cursor-pointer rounded-md border bg-transparent"
        />
      </div>
    </div>
  )
}
