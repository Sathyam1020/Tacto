"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import type { FormEmbed } from "@workspace/contracts/guide"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"

import { authClient } from "@/lib/auth-client"
import { useForms } from "@/lib/forms"

/**
 * Configure form OVERLAYS for a guide (in the Customize dialog). Each embed
 * shows a published form as a modal/sheet after a delay or a step — never as a
 * step in the sequence. Edits flow through `onChange` into the draft's `embeds`.
 */
export function FormEmbedEditor({
  embeds,
  steps,
  onChange,
}: {
  embeds: FormEmbed[]
  steps: { key: string; label: string }[]
  onChange: (embeds: FormEmbed[]) => void
}) {
  const { data: activeWorkspace } = authClient.useActiveOrganization()
  const { data: forms } = useForms(activeWorkspace?.id)
  const published = (forms ?? []).filter((f) => f.status === "PUBLISHED")

  const update = (i: number, patch: Partial<FormEmbed>) =>
    onChange(embeds.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))

  function add() {
    if (embeds.length >= 5) return
    onChange([
      ...embeds,
      {
        id: crypto.randomUUID(),
        formId: published[0]?.id ?? "",
        trigger: { kind: "after-delay", seconds: 15 },
        style: "modal",
        dismissible: true,
        showOnce: true,
      },
    ])
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Show a form over the guide — as a popup after a few seconds, or when the
        reader reaches a step. It never interrupts the steps.
      </p>

      {published.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Publish a form first, then embed it here.
        </p>
      )}

      {embeds.map((embed, i) => (
        <div key={embed.id} className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Form</span>
            <button
              aria-label="Remove embed"
              onClick={() => onChange(embeds.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-red-500"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <Select
            value={embed.formId}
            onValueChange={(v) => update(i, { formId: v ?? "" })}
          >
            <SelectTrigger aria-label="Form">
              <SelectValue placeholder="Select a form" />
            </SelectTrigger>
            <SelectContent>
              {published.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Show</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => update(i, { trigger: { kind: "after-delay", seconds: 15 } })}
                className={`h-9 rounded-lg border text-sm ${
                  embed.trigger.kind === "after-delay"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-muted"
                }`}
              >
                After a delay
              </button>
              <button
                onClick={() =>
                  update(i, {
                    trigger: { kind: "after-step", stepKey: steps[0]?.key ?? "" },
                  })
                }
                className={`h-9 rounded-lg border text-sm ${
                  embed.trigger.kind === "after-step"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-muted"
                }`}
              >
                After a step
              </button>
            </div>
            {embed.trigger.kind === "after-delay" ? (
              <label className="flex items-center gap-2 text-sm">
                <Input
                  type="number"
                  min={1}
                  max={3600}
                  value={embed.trigger.seconds}
                  onChange={(e) =>
                    update(i, {
                      trigger: { kind: "after-delay", seconds: Number(e.target.value) || 1 },
                    })
                  }
                  className="w-24"
                />
                seconds
              </label>
            ) : (
              <Select
                value={embed.trigger.stepKey}
                onValueChange={(v) =>
                  update(i, { trigger: { kind: "after-step", stepKey: v ?? "" } })
                }
              >
                <SelectTrigger aria-label="Step">
                  <SelectValue placeholder="Select a step" />
                </SelectTrigger>
                <SelectContent>
                  {steps.map((s, idx) => (
                    <SelectItem key={s.key} value={s.key}>
                      After step {idx + 1}
                      {s.label ? ` — ${s.label}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["modal", "sheet"] as const).map((st) => (
              <button
                key={st}
                onClick={() => update(i, { style: st })}
                className={`h-8 rounded-lg border text-sm capitalize ${
                  embed.style === st
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-muted"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <label className="flex items-center justify-between text-sm">
            <span>Show only once</span>
            <Switch checked={embed.showOnce} onCheckedChange={(v) => update(i, { showOnce: v })} />
          </label>
        </div>
      ))}

      {published.length > 0 && embeds.length < 5 && (
        <button
          onClick={add}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
        >
          <Plus className="size-4" />
          Add form
        </button>
      )}
    </div>
  )
}
