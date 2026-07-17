import {
  ingestShowcaseEventsSchema,
  videoEmbed,
  type PublicShowcase,
  type PublicShowcaseSection,
  type ShowcaseItemPayload,
  type ShowcaseItemType,
} from "@workspace/contracts/showcase";
import { Prisma, prisma } from "@workspace/db";
import { Router } from "express";
import { z } from "zod";

import { rateLimit } from "../../lib/rate-limit.js";
import { AppError } from "../../middleware/error.js";

/**
 * Public, unauthenticated Showcase by slug. Reachable as soon as it exists (so
 * owners can preview), but `noindex` until published + listed. GUIDE items only
 * appear when their guide is published; the Guide Reader renders them. Resource
 * items (video/pdf/link/form) carry their URL / form shareId.
 */
export const showcasePublicRouter: Router = Router();

const slugParam = z.object({ slug: z.string().min(1) });

const itemSelect = {
  id: true,
  type: true,
  title: true,
  url: true,
  formShareId: true,
  guide: { select: { title: true, shareId: true, status: true, deletedAt: true } },
} as const;

type ItemRow = Prisma.ShowcaseItemGetPayload<{ select: typeof itemSelect }>;

/** Resolve an item to its public payload, or null if it can't be shown. */
function toPublicItem(row: ItemRow): ShowcaseItemPayload | null {
  const type = row.type.toLowerCase() as ShowcaseItemType;
  if (type === "guide") {
    // Only published, non-deleted guides render.
    if (!row.guide || row.guide.status !== "PUBLISHED" || row.guide.deletedAt || !row.guide.shareId) {
      return null;
    }
    return {
      id: row.id,
      type,
      title: row.title || row.guide.title,
      guideShareId: row.guide.shareId,
      url: null,
      formShareId: null,
      videoProvider: null,
      thumbUrl: null,
    };
  }
  if (type === "form") {
    if (!row.formShareId) return null;
    return {
      id: row.id,
      type,
      title: row.title || "Form",
      guideShareId: null,
      url: null,
      formShareId: row.formShareId,
      videoProvider: null,
      thumbUrl: null,
    };
  }
  // video / pdf / link
  if (!row.url) return null;
  return {
    id: row.id,
    type,
    title: row.title || (type === "link" ? row.url : type.toUpperCase()),
    guideShareId: null,
    url: row.url,
    formShareId: null,
    videoProvider: type === "video" ? videoEmbed(row.url).provider : null,
    thumbUrl: null,
  };
}

showcasePublicRouter.get("/api/public/showcase/:slug", async (req, res) => {
  const { slug } = slugParam.parse(req.params);
  const sc = await prisma.showcase.findFirst({
    where: { slug },
    select: {
      slug: true,
      title: true,
      description: true,
      brandColor: true,
      logoUrl: true,
      theme: true,
      layout: true,
      autoplay: true,
      status: true,
      listed: true,
      sections: {
        where: { hidden: false },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          items: { orderBy: { position: "asc" }, select: itemSelect },
        },
      },
    },
  });
  if (!sc) throw new AppError(404, "NOT_FOUND", "Showcase not found");

  const sections: PublicShowcaseSection[] = sc.sections
    .map((s) => ({
      id: s.id,
      title: s.title,
      items: s.items.map(toPublicItem).filter((i): i is ShowcaseItemPayload => i !== null),
    }))
    // Drop sections that ended up empty (all items unpublished/invalid).
    .filter((s) => s.items.length > 0);

  const payload: PublicShowcase = {
    slug: sc.slug,
    title: sc.title,
    description: sc.description,
    brandColor: sc.brandColor,
    logoUrl: sc.logoUrl,
    theme: sc.theme,
    layout: sc.layout,
    autoplay: sc.autoplay,
    noindex: sc.status !== "PUBLISHED" || !sc.listed,
    sections,
  };
  res.json({ showcase: payload });
});

// ── Analytics beacon (showcase-level events) ────────────────────────────────
showcasePublicRouter.post("/api/public/showcase/:slug/events", async (req, res) => {
  const { slug } = slugParam.parse(req.params);
  const ip = req.ip ?? "unknown";
  if (!rateLimit(`scevents:${ip}:${slug}`, 60, 60_000)) {
    res.status(204).end();
    return;
  }
  const parsed = ingestShowcaseEventsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(204).end();
    return;
  }
  const { anonId, sessionId, events } = parsed.data;
  const sc = await prisma.showcase.findFirst({ where: { slug }, select: { id: true } });
  if (sc) {
    const rows: Prisma.ShowcaseEventCreateManyInput[] = events.map((e) => ({
      showcaseId: sc.id,
      type: e.type.toUpperCase() as Prisma.ShowcaseEventCreateManyInput["type"],
      anonId,
      sessionId,
      target: e.target ?? null,
    }));
    void prisma.showcaseEvent.createMany({ data: rows }).catch(() => {});
  }
  res.status(204).end();
});
