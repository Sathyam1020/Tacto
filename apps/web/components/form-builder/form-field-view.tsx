"use client"

import * as React from "react"
import { Star } from "lucide-react"

import type { FormDesign, FormField } from "@workspace/contracts/form"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Renders one form field's title/description + its input, styled by the form's
 * design. Shared by the builder preview and the public fill view. Controlled:
 * `value`/`onChange` own the answer. When `onChange` is omitted it's read-only
 * (builder preview).
 */
export function FormFieldView({
  field,
  value,
  onChange,
  design,
  autoFocus,
}: {
  field: FormField
  value: unknown
  onChange?: (value: unknown) => void
  design: FormDesign
  autoFocus?: boolean
}) {
  const readOnly = !onChange
  const inputStyle: React.CSSProperties = {
    color: design.answer,
    borderColor: `${design.answer}33`,
  }
  const alignClass = design.align === "center" ? "items-center text-center" : "items-start text-left"

  return (
    <div className={cn("flex w-full max-w-xl flex-col gap-4", alignClass)}>
      <div className="flex flex-col gap-1.5">
        {field.title && (
          <h2
            className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]"
            style={{ color: design.question }}
          >
            {field.title}
            {field.required && <span className="text-red-500"> *</span>}
          </h2>
        )}
        {field.description && (
          <p
            className="text-sm leading-relaxed [overflow-wrap:anywhere]"
            style={{ color: `${design.question}b3` }}
          >
            {field.description}
          </p>
        )}
      </div>

      {field.type === "statement" ? null : (
        <div className="w-full">
          {renderInput(field, value, onChange, design, inputStyle, readOnly, autoFocus)}
        </div>
      )}
    </div>
  )
}

function renderInput(
  field: FormField,
  value: unknown,
  onChange: ((v: unknown) => void) | undefined,
  design: FormDesign,
  inputStyle: React.CSSProperties,
  readOnly: boolean,
  autoFocus?: boolean
) {
  const base =
    "w-full rounded-lg border bg-transparent px-3 py-2.5 text-base outline-none transition-colors focus:border-current"
  const set = (v: unknown) => onChange?.(v)

  switch (field.type) {
    case "short_text":
    case "email":
    case "phone":
      return (
        <input
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          className={base}
          style={inputStyle}
          value={(value as string) ?? ""}
          placeholder={field.config.placeholder || "Type your answer…"}
          disabled={readOnly}
          autoFocus={autoFocus}
          onChange={(e) => set(e.target.value)}
        />
      )
    case "long_text":
      return (
        <textarea
          rows={4}
          className={cn(base, "resize-none")}
          style={inputStyle}
          value={(value as string) ?? ""}
          placeholder={field.config.placeholder || "Type your answer…"}
          disabled={readOnly}
          autoFocus={autoFocus}
          onChange={(e) => set(e.target.value)}
        />
      )
    case "number":
      return (
        <input
          type="number"
          className={base}
          style={inputStyle}
          value={(value as number | string) ?? ""}
          placeholder={field.config.placeholder || "0"}
          min={field.config.min ?? undefined}
          max={field.config.max ?? undefined}
          disabled={readOnly}
          autoFocus={autoFocus}
          onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))}
        />
      )
    case "date":
      return (
        <input
          type="date"
          className={base}
          style={inputStyle}
          value={(value as string) ?? ""}
          disabled={readOnly}
          onChange={(e) => set(e.target.value)}
        />
      )
    case "dropdown":
      return (
        <select
          className={base}
          style={inputStyle}
          value={(value as string) ?? ""}
          disabled={readOnly}
          onChange={(e) => set(e.target.value)}
        >
          <option value="">Select…</option>
          {field.config.options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case "single_select":
      return (
        <div className="flex flex-col gap-2">
          {field.config.options.map((o) => {
            const selected = value === o.key
            return (
              <button
                key={o.key}
                type="button"
                disabled={readOnly}
                onClick={() => set(o.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-base transition-colors",
                  selected ? "font-medium" : "hover:bg-current/[0.04]"
                )}
                style={{
                  ...inputStyle,
                  borderColor: selected ? design.button : `${design.answer}33`,
                  background: selected ? `${design.button}14` : undefined,
                }}
              >
                <span
                  className="flex size-4 flex-none items-center justify-center rounded-full border"
                  style={{ borderColor: selected ? design.button : `${design.answer}66` }}
                >
                  {selected && (
                    <span className="size-2 rounded-full" style={{ background: design.button }} />
                  )}
                </span>
                {o.label}
              </button>
            )
          })}
        </div>
      )
    case "multi_select": {
      const arr = Array.isArray(value) ? (value as string[]) : []
      return (
        <div className="flex flex-col gap-2">
          {field.config.options.map((o) => {
            const checked = arr.includes(o.key)
            return (
              <button
                key={o.key}
                type="button"
                disabled={readOnly}
                onClick={() =>
                  set(checked ? arr.filter((k) => k !== o.key) : [...arr, o.key])
                }
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-base transition-colors",
                  checked ? "font-medium" : "hover:bg-current/[0.04]"
                )}
                style={{
                  ...inputStyle,
                  borderColor: checked ? design.button : `${design.answer}33`,
                  background: checked ? `${design.button}14` : undefined,
                }}
              >
                <span
                  className="flex size-4 flex-none items-center justify-center rounded border"
                  style={{
                    borderColor: checked ? design.button : `${design.answer}66`,
                    background: checked ? design.button : undefined,
                  }}
                >
                  {checked && <span className="text-[10px] text-white">✓</span>}
                </span>
                {o.label}
              </button>
            )
          })}
        </div>
      )
    }
    case "rating": {
      const max = field.config.max ?? 5
      const current = typeof value === "number" ? value : 0
      return (
        <div className="flex gap-1.5">
          {Array.from({ length: max }).map((_, i) => {
            const n = i + 1
            return (
              <button
                key={n}
                type="button"
                disabled={readOnly}
                onClick={() => set(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >
                <Star
                  className="size-8 transition-transform hover:scale-110"
                  style={{ color: design.button }}
                  fill={n <= current ? design.button : "transparent"}
                />
              </button>
            )
          })}
        </div>
      )
    }
    default:
      return null
  }
}
