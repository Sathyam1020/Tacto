import { z } from "zod";

/**
 * Showcase contracts. A Showcase is a branded, embeddable collection of a
 * workspace's content — published guides AND resources (video/pdf/link/form) —
 * organized into sections and presented in one of three layouts. Many per
 * workspace. Guides are referenced (never copied); the Guide Reader renders them.
 */

// ── Enums ────────────────────────────────────────────────────────────────────
export const showcaseLayoutSchema = z.enum(["SECTION", "CHECKLIST", "GALLERY"]);
export type ShowcaseLayout = z.infer<typeof showcaseLayoutSchema>;

export const showcaseStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);
export type ShowcaseStatus = z.infer<typeof showcaseStatusSchema>;

/** Item kinds (lowercase on the wire; DB stores uppercase). */
export const showcaseItemTypeSchema = z.enum(["guide", "video", "pdf", "link", "form"]);
export type ShowcaseItemType = z.infer<typeof showcaseItemTypeSchema>;

// ── Shared ───────────────────────────────────────────────────────────────────
export const showcaseSlugSchema = z
  .string()
  .trim()
  .min(2, "Too short")
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and dashes");

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB hex color");

export const showcaseSeoSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(200).optional(),
  ogImage: z.string().url().optional(),
});
export type ShowcaseSeo = z.infer<typeof showcaseSeoSchema>;

// ── Owner input ──────────────────────────────────────────────────────────────
export const createShowcaseSchema = z.object({
  title: z.string().trim().min(1, "Name your showcase").max(80),
});

export const updateShowcaseSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(300).nullable().optional(),
  slug: showcaseSlugSchema.optional(),
  listed: z.boolean().optional(),
  layout: showcaseLayoutSchema.optional(),
  autoplay: z.boolean().optional(),
  brandColor: hexColor.nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  seo: showcaseSeoSchema.nullable().optional(),
});
export type ShowcaseSettingsInput = z.infer<typeof updateShowcaseSchema>;

export const createSectionSchema = z.object({
  title: z.string().trim().min(1, "Name the section").max(80),
});
export const updateSectionSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  hidden: z.boolean().optional(),
});

/** Reorder sections or items by id. */
export const reorderSchema = z.object({ ids: z.array(z.string()).min(1) });

/** Bulk-add published guides to a section (each becomes a GUIDE item). */
export const addGuidesSchema = z.object({
  guideIds: z.array(z.string()).min(1).max(100),
});

/** Add one resource item (discriminated by kind). */
export const addResourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("video"), url: z.string().url(), title: z.string().max(120).optional() }),
  z.object({ type: z.literal("pdf"), url: z.string().url(), title: z.string().max(120).optional() }),
  z.object({ type: z.literal("link"), url: z.string().url(), title: z.string().max(120).optional() }),
  z.object({ type: z.literal("form"), formShareId: z.string().min(1), title: z.string().max(120).optional() }),
]);
export type AddResourceInput = z.infer<typeof addResourceSchema>;

export const updateItemSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  url: z.string().url().optional(),
});

// ── Owner response shapes ────────────────────────────────────────────────────
export type ShowcaseItemDetail = {
  id: string;
  type: ShowcaseItemType;
  title: string | null;
  url: string | null;
  formShareId: string | null;
  /** Present for GUIDE items. */
  guide: {
    id: string;
    title: string;
    shareId: string | null;
    status: "DRAFT" | "PUBLISHED";
    stepCount: number;
  } | null;
};

export type ShowcaseSectionDetail = {
  id: string;
  title: string;
  position: number;
  hidden: boolean;
  items: ShowcaseItemDetail[];
};

export type ShowcaseDetail = {
  id: string;
  slug: string;
  status: ShowcaseStatus;
  listed: boolean;
  title: string;
  description: string | null;
  layout: ShowcaseLayout;
  autoplay: boolean;
  brandColor: string | null;
  logoUrl: string | null;
  theme: string;
  seo: ShowcaseSeo | null;
  publishedAt: string | null;
  sections: ShowcaseSectionDetail[];
};

export type ShowcaseCard = {
  id: string;
  slug: string;
  title: string;
  layout: ShowcaseLayout;
  status: ShowcaseStatus;
  itemCount: number;
  updatedAt: string;
};

// ── Public payloads ──────────────────────────────────────────────────────────
export type ShowcaseItemPayload = {
  id: string;
  type: ShowcaseItemType;
  title: string;
  /** GUIDE → the guide's shareId (rendered by the reader). */
  guideShareId: string | null;
  /** VIDEO/PDF/LINK → the URL. */
  url: string | null;
  /** FORM → the form shareId. */
  formShareId: string | null;
  /** VIDEO → detected provider for the right renderer. */
  videoProvider: "youtube" | "vimeo" | "loom" | "mp4" | "other" | null;
  /** Thumbnail for the gallery layout (guide cover / provider thumb / null). */
  thumbUrl: string | null;
};

export type PublicShowcaseSection = {
  id: string;
  title: string;
  items: ShowcaseItemPayload[];
};

export type PublicShowcaseChrome = {
  slug: string;
  title: string;
  description: string | null;
  brandColor: string | null;
  logoUrl: string | null;
  theme: string;
  layout: ShowcaseLayout;
  autoplay: boolean;
  /** True until published (or when unlisted) — renders but is noindex. */
  noindex: boolean;
};

export type PublicShowcase = PublicShowcaseChrome & {
  sections: PublicShowcaseSection[];
};

// ── Analytics ────────────────────────────────────────────────────────────────
export const showcaseEventTypeSchema = z.enum([
  "view",
  "item_open",
  "item_complete",
  "complete",
  "contact_click",
]);
export type ShowcaseEventType = z.infer<typeof showcaseEventTypeSchema>;

export const ingestShowcaseEventsSchema = z.object({
  anonId: z.string().max(64).nullable(),
  sessionId: z.string().min(8).max(64),
  events: z
    .array(
      z.object({
        type: showcaseEventTypeSchema,
        /** ITEM_OPEN/ITEM_COMPLETE → item id; else omitted. */
        target: z.string().max(64).optional(),
      })
    )
    .min(1)
    .max(50),
});
export type IngestShowcaseEventsInput = z.infer<typeof ingestShowcaseEventsSchema>;

export const SHOWCASE_ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;
export type ShowcaseAnalyticsRange = (typeof SHOWCASE_ANALYTICS_RANGES)[number];

export type ShowcaseAnalytics = {
  range: ShowcaseAnalyticsRange;
  totals: {
    views: number;
    uniqueVisitors: number;
    completionRate: number;
    itemOpens: number;
  };
  trend: { date: string; views: number; itemOpens: number }[];
  /** Per-item engagement (opens + completes). */
  topItems: { itemId: string; title: string; opens: number; completes: number }[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Pick the right embed for a video URL (shared by the builder preview + viewer). */
export function videoEmbed(url: string): {
  provider: "youtube" | "vimeo" | "loom" | "mp4" | "other";
  embedUrl: string | null;
} {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      return { provider: "youtube", embedUrl: id ? `https://www.youtube.com/embed/${id}` : null };
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return { provider: "youtube", embedUrl: id ? `https://www.youtube.com/embed/${id}` : null };
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return { provider: "vimeo", embedUrl: id ? `https://player.vimeo.com/video/${id}` : null };
    }
    if (host.endsWith("loom.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return { provider: "loom", embedUrl: id ? `https://www.loom.com/embed/${id}` : null };
    }
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u.pathname)) return { provider: "mp4", embedUrl: url };
    return { provider: "other", embedUrl: url };
  } catch {
    return { provider: "other", embedUrl: null };
  }
}
