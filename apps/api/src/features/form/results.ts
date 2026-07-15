import type { FormField } from "@workspace/contracts/form";

/**
 * Pure aggregation of form submissions → analytics + per-question summary + CSV.
 * Kept separate from the router so it's unit-testable.
 */

export type SubmissionRow = {
  answers: Record<string, unknown>;
  durationMs: number | null;
  createdAt: Date;
};

function isBlank(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Analytics ────────────────────────────────────────────────────────────────

export type Analytics = {
  views: number;
  starts: number;
  submissions: number;
  completionRate: number; // 0–100
  avgCompletionMs: number | null;
  trend: { date: string; count: number }[];
};

export function computeAnalytics(
  counters: { views: number; starts: number; submissions: number },
  rows: SubmissionRow[],
  days: number,
  now: Date
): Analytics {
  const durations = rows
    .map((r) => r.durationMs)
    .filter((n): n is number => n != null && n >= 0);
  const avgCompletionMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  // Bucket submissions per day, then fill the last `days` days contiguously.
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(dayKey(r.createdAt), (byDay.get(dayKey(r.createdAt)) ?? 0) + 1);
  const trend: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = dayKey(d);
    trend.push({ date: key, count: byDay.get(key) ?? 0 });
  }

  return {
    views: counters.views,
    starts: counters.starts,
    submissions: counters.submissions,
    completionRate: counters.starts > 0
      ? Math.round((counters.submissions / counters.starts) * 100)
      : 0,
    avgCompletionMs,
    trend,
  };
}

// ── Per-question summary ─────────────────────────────────────────────────────

export type FieldSummary = {
  key: string;
  title: string;
  type: FormField["type"];
  responses: number;
  options?: { label: string; count: number }[];
  average?: number;
  min?: number;
  max?: number;
  samples?: string[];
};

export function computeSummary(
  fields: FormField[],
  rows: SubmissionRow[]
): FieldSummary[] {
  const summaries: FieldSummary[] = [];
  for (const field of fields) {
    if (field.type === "statement") continue;
    const values = rows.map((r) => r.answers[field.key]).filter((v) => !isBlank(v));
    const summary: FieldSummary = {
      key: field.key,
      title: field.title || field.type,
      type: field.type,
      responses: values.length,
    };

    if (field.type === "single_select" || field.type === "dropdown" || field.type === "multi_select") {
      const counts = new Map<string, number>();
      for (const v of values) {
        const keys = Array.isArray(v) ? (v as string[]) : [v as string];
        for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      summary.options = field.config.options.map((o) => ({
        label: o.label,
        count: counts.get(o.key) ?? 0,
      }));
    } else if (field.type === "rating" || field.type === "number") {
      const nums = values
        .map((v) => (typeof v === "number" ? v : Number(v)))
        .filter((n) => Number.isFinite(n));
      if (nums.length) {
        summary.average =
          Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
        summary.min = Math.min(...nums);
        summary.max = Math.max(...nums);
      }
    } else {
      summary.samples = values.slice(-5).reverse().map((v) => String(v));
    }
    summaries.push(summary);
  }
  return summaries;
}

// ── CSV export ───────────────────────────────────────────────────────────────

function csvCell(v: unknown, field?: FormField): string {
  let text: string;
  if (v == null) text = "";
  else if (Array.isArray(v)) {
    // Map option keys → labels when we know the field.
    const labels = field
      ? v.map((k) => field.config.options.find((o) => o.key === k)?.label ?? String(k))
      : v.map(String);
    text = labels.join("; ");
  } else if (field && (field.type === "single_select" || field.type === "dropdown")) {
    text = field.config.options.find((o) => o.key === v)?.label ?? String(v);
  } else text = String(v);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(fields: FormField[], rows: SubmissionRow[]): string {
  const cols = fields.filter((f) => f.type !== "statement");
  const header = ["Submitted at", ...cols.map((f) => f.title || f.type)];
  const lines = [header.map((h) => csvCell(h)).join(",")];
  for (const r of rows) {
    const cells = [
      csvCell(r.createdAt.toISOString()),
      ...cols.map((f) => csvCell(r.answers[f.key], f)),
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}
