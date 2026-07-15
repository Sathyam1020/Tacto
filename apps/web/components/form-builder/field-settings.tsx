"use client"

import * as React from "react"
import { GripVertical, Plus, X } from "lucide-react"

import type { FormField } from "@workspace/contracts/form"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"

import { CHOICE_TYPES, newOption } from "@/lib/form-fields"

/** Right-panel settings for the selected field. Every change flows through
 *  `onChange` (which the builder routes to its autosaved draft). The field's
 *  type is chosen when adding it (left palette) — not editable here. */
export function FieldSettings({
  field,
  onChange,
}: {
  field: FormField
  onChange: (next: FormField) => void
}) {
  const patch = (p: Partial<FormField>) => onChange({ ...field, ...p })
  const patchConfig = (p: Partial<FormField["config"]>) =>
    onChange({ ...field, config: { ...field.config, ...p } })

  return (
    <div className="flex flex-col gap-5">
      <Row label={field.type === "statement" ? "Title" : "Question"}>
        <Input value={field.title} onChange={(e) => patch({ title: e.target.value })} />
      </Row>

      <Row label="Description">
        <Textarea
          rows={2}
          value={field.description}
          placeholder="Optional helper text"
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Row>

      {field.type !== "statement" && (
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium">Required</span>
          <Switch
            checked={field.required}
            onCheckedChange={(v) => patch({ required: v })}
          />
        </label>
      )}

      {/* Type-specific config */}
      {(field.type === "short_text" ||
        field.type === "long_text" ||
        field.type === "email" ||
        field.type === "phone" ||
        field.type === "number") && (
        <Row label="Placeholder">
          <Input
            value={field.config.placeholder}
            onChange={(e) => patchConfig({ placeholder: e.target.value })}
          />
        </Row>
      )}

      {field.type === "number" && (
        <div className="flex gap-3">
          <Row label="Min">
            <Input
              type="number"
              value={field.config.min ?? ""}
              onChange={(e) =>
                patchConfig({ min: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </Row>
          <Row label="Max">
            <Input
              type="number"
              value={field.config.max ?? ""}
              onChange={(e) =>
                patchConfig({ max: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </Row>
        </div>
      )}

      {field.type === "rating" && (
        <Row label="Stars">
          <Input
            type="number"
            min={2}
            max={10}
            value={field.config.max ?? 5}
            onChange={(e) => patchConfig({ max: Number(e.target.value) || 5 })}
          />
        </Row>
      )}

      {field.type === "statement" && (
        <Row label="Button text">
          <Input
            value={field.config.buttonText}
            onChange={(e) => patchConfig({ buttonText: e.target.value })}
          />
        </Row>
      )}

      {CHOICE_TYPES.includes(field.type) && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Options</span>
          {field.config.options.map((opt, i) => (
            <div key={opt.key} className="flex items-center gap-1.5">
              <GripVertical className="size-4 flex-none text-muted-foreground/50" />
              <Input
                value={opt.label}
                onChange={(e) => {
                  const options = field.config.options.slice()
                  options[i] = { ...opt, label: e.target.value }
                  patchConfig({ options })
                }}
              />
              <button
                aria-label="Remove option"
                className="flex size-7 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                disabled={field.config.options.length <= 1}
                onClick={() =>
                  patchConfig({
                    options: field.config.options.filter((o) => o.key !== opt.key),
                  })
                }
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              patchConfig({
                options: [...field.config.options, newOption(field.config.options.length + 1)],
              })
            }
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10"
          >
            <Plus className="size-4" />
            Add option
          </button>
          <label className="mt-1 flex items-center justify-between">
            <span className="text-sm">Allow “Other”</span>
            <Switch
              checked={field.config.allowOther}
              onCheckedChange={(v) => patchConfig({ allowOther: v })}
            />
          </label>
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
