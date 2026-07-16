import { z } from "zod";

/**
 * Help Center contracts. A Help Center collects a workspace's PUBLISHED guides
 * into branded, ordered collections at a public URL. An article is ALWAYS a
 * published guide — these schemas cover organization, branding, and navigation
 * only, never guide content (which the Guide Reader renders unchanged).
 */

export const helpCenterStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);
export type HelpCenterStatus = z.infer<typeof helpCenterStatusSchema>;

/** A popular default set shown before the user searches the full icon library. */
export const SUGGESTED_COLLECTION_ICONS = [
  "Rocket",
  "BookOpen",
  "Users",
  "BarChart3",
  "Code2",
  "LifeBuoy",
  "Settings2",
  "Zap",
  "Shield",
  "CreditCard",
  "Puzzle",
  "MessageSquare",
  "Lock",
  "Wrench",
  "Bell",
  "Star",
  "Heart",
  "Globe",
  "Mail",
  "Package",
  "Play",
  "Sparkles",
  "Gauge",
  "Building2",
] as const;

/** Any lucide icon name (PascalCase). The renderer falls back if unknown. */
export const collectionIconSchema = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[A-Za-z][A-Za-z0-9]*$/, "Invalid icon name");
export type CollectionIcon = z.infer<typeof collectionIconSchema>;

export const slugSchema = z
  .string()
  .trim()
  .min(2, "Too short")
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and dashes");

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB hex color");

export const helpNavLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  href: z.string().trim().min(1).max(500),
  external: z.boolean().default(false),
});
export type HelpNavLink = z.infer<typeof helpNavLinkSchema>;

export const helpSeoSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(200).optional(),
  ogImage: z.string().url().optional(),
});
export type HelpSeo = z.infer<typeof helpSeoSchema>;

/** PATCH /help-center — all fields optional (partial update of branding/chrome). */
export const helpCenterSettingsSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  slug: slugSchema.optional(),
  listed: z.boolean().optional(),
  logoUrl: z.string().url().nullable().optional(),
  brandColor: hexColor.nullable().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  faviconUrl: z.string().url().nullable().optional(),
  heroTitle: z.string().trim().min(1).max(80).optional(),
  heroSubtitle: z.string().max(160).nullable().optional(),
  navLinks: z.array(helpNavLinkSchema).max(6).optional(),
  footerLinks: z.array(helpNavLinkSchema).max(6).optional(),
  contactFormId: z.string().nullable().optional(),
  statusUrl: z.string().url().nullable().optional(),
  seo: helpSeoSchema.nullable().optional(),
});
export type HelpCenterSettingsInput = z.infer<typeof helpCenterSettingsSchema>;

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1, "Name your collection").max(60),
  description: z.string().max(200).optional(),
  icon: collectionIconSchema.optional(),
});
export const updateCollectionSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().max(200).nullable().optional(),
  icon: collectionIconSchema.nullable().optional(),
  hidden: z.boolean().optional(),
});

/** Reorder collections or articles by id. */
export const reorderSchema = z.object({ ids: z.array(z.string()).min(1) });
export const addArticlesSchema = z.object({
  guideIds: z.array(z.string()).min(1).max(100),
});
export const featureSchema = z.object({ featured: z.boolean() });

/**
 * Estimated read time from a guide's step count — shared by the API, the
 * builder cards, and the public site so the number is consistent everywhere.
 * Mirrors the guide-card heuristic (~0.6 min/step, min 1).
 */
export function estimateReadMinutes(stepCount: number): number {
  return Math.max(1, Math.round(stepCount * 0.6));
}

// ── Response shapes (single source of truth for API + web) ──────────────────

export type HelpArticleCard = {
  id: string;
  guideId: string;
  title: string;
  excerpt: string | null;
  readMinutes: number;
  featured: boolean;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  stepCount: number;
};

export type HelpCollectionDetail = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  slug: string;
  position: number;
  hidden: boolean;
  articles: HelpArticleCard[];
};

export type HelpCenterDetail = {
  id: string;
  slug: string;
  status: HelpCenterStatus;
  listed: boolean;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  theme: string;
  faviconUrl: string | null;
  heroTitle: string;
  heroSubtitle: string | null;
  navLinks: HelpNavLink[];
  footerLinks: HelpNavLink[];
  contactFormId: string | null;
  statusUrl: string | null;
  seo: HelpSeo | null;
  publishedAt: string | null;
  collections: HelpCollectionDetail[];
};

/** Reverse lookup for the guide editor's "Published In" section. */
export type GuideHelpPlacement = {
  helpCenterSlug: string;
  featured: boolean;
  collections: { id: string; name: string; slug: string }[];
};

// ── Public payloads ─────────────────────────────────────────────────────────

export type PublicHelpArticle = {
  title: string;
  excerpt: string | null;
  readMinutes: number;
  slug: string;
  collectionSlug: string;
};

export type PublicHelpCollection = {
  name: string;
  description: string | null;
  icon: string | null;
  slug: string;
  count: number;
  articles: PublicHelpArticle[];
};

export type PublicHelpCenter = {
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  theme: string;
  heroTitle: string;
  heroSubtitle: string | null;
  navLinks: HelpNavLink[];
  footerLinks: HelpNavLink[];
  statusUrl: string | null;
  noindex: boolean;
  collections: PublicHelpCollection[];
  featured: PublicHelpArticle[];
};

export type HelpSearchHit = {
  title: string;
  excerpt: string;
  slug: string;
  collectionSlug: string;
  collectionName: string;
};

// ── Analytics (help-center-level engagement) ────────────────────────────────
// Site-wide events (visits, searches, collection opens, contact clicks). Guide
// reads stay in GuideEvent; this only covers the help-center shell. Mirrors the
// GuideEventType lowercase convention (client sends lowercase, DB stores upper).

export const helpCenterEventTypeSchema = z.enum([
  "view",
  "search",
  "collection_open",
  "contact_click",
]);
export type HelpCenterEventType = z.infer<typeof helpCenterEventTypeSchema>;

/** Batched beacon body — one visit's help-center events. */
export const ingestHelpEventsSchema = z.object({
  anonId: z.string().max(64).nullable(),
  sessionId: z.string().min(8).max(64),
  events: z
    .array(
      z.object({
        type: helpCenterEventTypeSchema,
        /** SEARCH → query; COLLECTION_OPEN → collection slug; else omitted. */
        target: z.string().max(200).optional(),
        /** SEARCH only → whether the query returned zero results. */
        zeroResults: z.boolean().optional(),
      })
    )
    .min(1)
    .max(50),
});
export type IngestHelpEventsInput = z.infer<typeof ingestHelpEventsSchema>;

/**
 * Analytics window. Mirrors `guide-analytics`'s range (kept local so this
 * contract subpath has no sibling-source import — the bundler resolves package
 * subpaths, not relative `.ts` files reached through them). The API validates
 * incoming ranges with the canonical `analyticsRangeSchema` from guide-analytics.
 */
export const HELP_ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;
export type AnalyticsRange = (typeof HELP_ANALYTICS_RANGES)[number];

/** Owner-facing help-center analytics (single source of truth for API + web). */
export type HelpCenterAnalytics = {
  range: AnalyticsRange;
  totals: {
    /** Distinct visit sessions that hit the homepage (`view`). */
    visits: number;
    /** Distinct anonIds across all events. */
    uniqueVisitors: number;
    /** Total searches performed. */
    searches: number;
    /** % of searches that returned nothing. */
    zeroResultRate: number;
    /** Distinct article-read sessions (from GuideEvent, help-center source). */
    articleViews: number;
  };
  trend: { date: string; visits: number; searches: number; articleViews: number }[];
  /** Most-read articles in this center (by distinct read session). */
  topArticles: { title: string; slug: string; collectionSlug: string; views: number }[];
  /** Most-searched queries (with each query's zero-result share). */
  topSearches: { query: string; count: number; zeroRate: number }[];
  /** Searches that returned nothing — the content-gap list. */
  zeroResultSearches: { query: string; count: number }[];
  /** Most-opened collections. */
  topCollections: { slug: string; opens: number }[];
};

/** Brand + navigation shared by every public help-center page (header/footer). */
export type PublicHelpChrome = {
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  theme: string;
  navLinks: HelpNavLink[];
  footerLinks: HelpNavLink[];
  statusUrl: string | null;
  /** True until published (or when unlisted) — the page renders but is noindex. */
  noindex: boolean;
};

export type PublicHelpCollectionPage = {
  chrome: PublicHelpChrome;
  collection: PublicHelpCollection;
  siblings: { name: string; slug: string; icon: string | null }[];
};

export type PublicHelpArticlePage = {
  chrome: PublicHelpChrome;
  collection: { name: string; slug: string };
  article: { title: string; slug: string };
  /** The article's published guide — rendered by the existing Guide Reader. */
  guideShareId: string;
  related: PublicHelpArticle[];
};
