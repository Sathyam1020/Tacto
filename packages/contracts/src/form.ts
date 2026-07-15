import { z } from "zod";

import { guideFontSchema } from "@workspace/contracts/guide";

/**
 * Forms — the shared contract for the form builder, the published form document,
 * public submissions, and analytics. Mirrors the Guide draft/publish model: the
 * builder edits a versioned `FormDocument`; publishing copies it onto the Form
 * (bumping `documentVersion`). See docs/plans/phase-11-forms-rfc.md.
 */

// ── Fields ───────────────────────────────────────────────────────────────────

export const fieldTypeSchema = z.enum([
  "statement",
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "single_select",
  "multi_select",
  "dropdown",
  "rating",
  "date",
]);
export type FieldType = z.infer<typeof fieldTypeSchema>;

/** A choice option for select/dropdown fields. `key` is stable; `label` shown. */
export const fieldOptionSchema = z.object({
  key: z.string().min(1),
  label: z.string().max(300),
});
export type FieldOption = z.infer<typeof fieldOptionSchema>;

/** Type-specific config. All fields optional/defaulted so a bare field parses;
 *  only the keys relevant to a field's `type` are meaningful. */
export const fieldConfigSchema = z.object({
  placeholder: z.string().max(200).default(""),
  maxLength: z.number().int().positive().max(50_000).nullable().default(null),
  min: z.number().nullable().default(null),
  max: z.number().nullable().default(null),
  options: z.array(fieldOptionSchema).max(50).default([]),
  allowOther: z.boolean().default(false),
  /** Statement fields only — the CTA button text (e.g. "Let's start"). */
  buttonText: z.string().max(80).default(""),
});
export type FieldConfig = z.infer<typeof fieldConfigSchema>;

export const formFieldSchema = z.object({
  /** Stable identity across edits; submission answers are keyed by this. */
  key: z.string().min(1),
  type: fieldTypeSchema,
  title: z.string().max(500).default(""),
  description: z.string().max(2000).default(""),
  required: z.boolean().default(false),
  config: fieldConfigSchema.default(fieldConfigSchema.parse({})),
});
export type FormField = z.infer<typeof formFieldSchema>;

// ── Document (thank-you, design, settings) ───────────────────────────────────

export const formThankYouSchema = z.object({
  title: z.string().max(300).default("Thank you!"),
  description: z.string().max(2000).default(""),
});
export type FormThankYou = z.infer<typeof formThankYouSchema>;

/** Design/theme for the public form. Hex colors + a shared font enum. */
export const formDesignSchema = z.object({
  background: z.string().default("#ffffff"),
  question: z.string().default("#111318"),
  answer: z.string().default("#111318"),
  button: z.string().default("#5e6ad2"),
  buttonText: z.string().default("#ffffff"),
  font: guideFontSchema.default("Geist"),
  align: z.enum(["left", "center"]).default("left"),
});
export type FormDesign = z.infer<typeof formDesignSchema>;

export const formSettingsSchema = z.object({
  acceptingSubmissions: z.boolean().default(true),
  closedMessage: z
    .string()
    .max(500)
    .default("This form is no longer accepting responses."),
  showProgressBar: z.boolean().default(true),
  redirectUrl: z.string().url().nullable().default(null),
});
export type FormSettings = z.infer<typeof formSettingsSchema>;

/** v1 — the current autosaved/published form shape. Versioned + migrate-on-read
 *  so future shapes upgrade in memory (mirrors the guide draft document). */
export const formDocumentV1Schema = z.object({
  v: z.literal(1),
  title: z.string().max(200),
  description: z.string().max(2000).nullable(),
  fields: z.array(formFieldSchema).max(200),
  thankYou: formThankYouSchema.default(formThankYouSchema.parse({})),
  design: formDesignSchema.default(formDesignSchema.parse({})),
  settings: formSettingsSchema.default(formSettingsSchema.parse({})),
});
export type FormDocumentV1 = z.infer<typeof formDocumentV1Schema>;

export const formDocumentSchema = z.discriminatedUnion("v", [
  formDocumentV1Schema,
]);
export type FormDocument = z.infer<typeof formDocumentSchema>;

/** An empty document — the seed for a fresh form. */
export function emptyFormDocument(
  title: string,
  description: string | null
): FormDocumentV1 {
  return {
    v: 1,
    title,
    description,
    fields: [],
    thankYou: formThankYouSchema.parse({}),
    design: formDesignSchema.parse({}),
    settings: formSettingsSchema.parse({}),
  };
}

/** Parse a stored document, upgrading older versions to the current shape.
 *  (v1 only today; the seam exists for future migrations.) */
export function parseFormDocument(
  raw: unknown
):
  | { success: true; data: FormDocumentV1 }
  | { success: false; error: z.ZodError } {
  const parsed = formDocumentSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error };
  return { success: true, data: parsed.data };
}

/** Read a published `Form.document` JSON value as a document, or null. */
export function readFormDocument(raw: unknown): FormDocumentV1 | null {
  const parsed = parseFormDocument(raw);
  return parsed.success ? parsed.data : null;
}

/** Resolve a (possibly partial/null) design to a complete one with defaults. */
export function resolveFormDesign(raw: unknown): FormDesign {
  const parsed = formDesignSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : formDesignSchema.parse({});
}

// ── Draft autosave + form CRUD ───────────────────────────────────────────────

/** Autosave PATCH body — optimistic-concurrency (mirrors draftPatchSchema). */
export const formDraftPatchSchema = z.object({
  baseVersion: z.number().int().nonnegative(),
  document: formDocumentSchema,
});
export type FormDraftPatch = z.infer<typeof formDraftPatchSchema>;

export const createFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  folderId: z.string().nullish(),
});

export const renameFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

// ── Submissions ──────────────────────────────────────────────────────────────

/** A public submission. `formVersion` is the document version the respondent
 *  filled (stored on the submission for future analytics/reporting). Answers are
 *  validated server-side against the published fields via `validateSubmission`. */
export const submissionInputSchema = z.object({
  anonId: z.string().max(64).nullish(),
  answers: z.record(z.string(), z.unknown()),
  durationMs: z.number().int().nonnegative().nullish(),
  formVersion: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});
export type SubmissionInput = z.infer<typeof submissionInputSchema>;

export type SubmissionError = { fieldKey: string; message: string };

function isBlank(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Server-authoritative validation of a submission against the published fields.
 * Returns the list of errors (empty = valid). `statement` fields expect no answer.
 */
export function validateSubmission(
  fields: FormField[],
  answers: Record<string, unknown>
): SubmissionError[] {
  const errors: SubmissionError[] = [];
  const err = (fieldKey: string, message: string) =>
    errors.push({ fieldKey, message });

  for (const field of fields) {
    if (field.type === "statement") continue;
    const value = answers[field.key];
    const blank = isBlank(value);

    if (blank) {
      if (field.required) err(field.key, "This field is required.");
      continue;
    }

    switch (field.type) {
      case "short_text":
      case "long_text":
      case "phone": {
        if (typeof value !== "string") err(field.key, "Expected text.");
        else if (field.config.maxLength && value.length > field.config.maxLength)
          err(field.key, `Must be at most ${field.config.maxLength} characters.`);
        break;
      }
      case "email": {
        if (typeof value !== "string" || !EMAIL_RE.test(value.trim()))
          err(field.key, "Enter a valid email address.");
        break;
      }
      case "number": {
        const n = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(n)) err(field.key, "Enter a valid number.");
        else {
          if (field.config.min != null && n < field.config.min)
            err(field.key, `Must be at least ${field.config.min}.`);
          if (field.config.max != null && n > field.config.max)
            err(field.key, `Must be at most ${field.config.max}.`);
        }
        break;
      }
      case "rating": {
        const n = typeof value === "number" ? value : Number(value);
        const max = field.config.max ?? 5;
        if (!Number.isInteger(n) || n < 1 || n > max)
          err(field.key, `Choose a rating from 1 to ${max}.`);
        break;
      }
      case "date": {
        if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
          err(field.key, "Enter a valid date.");
        break;
      }
      case "single_select":
      case "dropdown": {
        const keys = field.config.options.map((o) => o.key);
        if (typeof value !== "string") err(field.key, "Choose an option.");
        else if (!keys.includes(value) && !(field.config.allowOther && value))
          err(field.key, "Choose a valid option.");
        break;
      }
      case "multi_select": {
        if (!Array.isArray(value)) {
          err(field.key, "Choose one or more options.");
          break;
        }
        const keys = new Set(field.config.options.map((o) => o.key));
        for (const v of value) {
          if (typeof v !== "string" || (!keys.has(v) && !field.config.allowOther))
            err(field.key, "Invalid selection.");
        }
        if (field.config.min != null && value.length < field.config.min)
          err(field.key, `Choose at least ${field.config.min}.`);
        if (field.config.max != null && value.length > field.config.max)
          err(field.key, `Choose at most ${field.config.max}.`);
        break;
      }
    }
  }
  return errors;
}
