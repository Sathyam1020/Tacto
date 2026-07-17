import {
  addGuidesSchema,
  addResourceSchema,
  createSectionSchema,
  createShowcaseSchema,
  reorderSchema,
  updateItemSchema,
  updateSectionSchema,
  updateShowcaseSchema,
  type ShowcaseCard,
  type ShowcaseDetail,
  type ShowcaseItemDetail,
  type ShowcaseItemType,
  type ShowcaseSeo,
} from "@workspace/contracts/showcase";
import { Prisma, prisma } from "@workspace/db";
import { Router } from "express";
import { z } from "zod";

import { ANALYTICS_RANGE_DAYS, analyticsRangeSchema } from "@workspace/contracts/guide-analytics";

import { AppError } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";
import { uniqueSlug } from "../help-center/slug.js";
import { computeShowcaseAnalytics, type ShowcaseEventRow } from "./analytics.js";

/** Showcases — owner (authenticated) management. Many per workspace. Items are
 *  published guides (rendered by the Guide Reader) or resources. */
export const showcaseRouter: Router = Router();

const idParam = z.object({ id: z.string() });
const sectionParam = z.object({ id: z.string(), sid: z.string() });
const itemParam = z.object({ id: z.string(), iid: z.string() });

// ── helpers ──────────────────────────────────────────────────────────────────
async function assertShowcase(id: string, organizationId: string): Promise<void> {
  const s = await prisma.showcase.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!s) throw new AppError(404, "NOT_FOUND", "Showcase not found");
}
async function assertSection(showcaseId: string, sid: string): Promise<void> {
  const sec = await prisma.showcaseSection.findFirst({ where: { id: sid, showcaseId }, select: { id: true } });
  if (!sec) throw new AppError(404, "NOT_FOUND", "Section not found");
}

const itemSelect = {
  id: true,
  type: true,
  title: true,
  url: true,
  formShareId: true,
  guide: {
    select: {
      id: true,
      title: true,
      shareId: true,
      status: true,
      _count: { select: { blocks: { where: { type: "STEP" as const } } } },
    },
  },
} as const;

type ItemRow = Prisma.ShowcaseItemGetPayload<{ select: typeof itemSelect }>;

function serializeItem(row: ItemRow): ShowcaseItemDetail {
  return {
    id: row.id,
    type: row.type.toLowerCase() as ShowcaseItemType,
    title: row.title,
    url: row.url,
    formShareId: row.formShareId,
    guide: row.guide
      ? {
          id: row.guide.id,
          title: row.guide.title,
          shareId: row.guide.shareId,
          status: row.guide.status,
          stepCount: row.guide._count.blocks,
        }
      : null,
  };
}

async function loadDetail(id: string): Promise<ShowcaseDetail> {
  const s = await prisma.showcase.findUniqueOrThrow({
    where: { id },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: { items: { orderBy: { position: "asc" }, select: itemSelect } },
      },
    },
  });
  return {
    id: s.id,
    slug: s.slug,
    status: s.status,
    listed: s.listed,
    title: s.title,
    description: s.description,
    layout: s.layout,
    autoplay: s.autoplay,
    brandColor: s.brandColor,
    logoUrl: s.logoUrl,
    theme: s.theme,
    seo: (s.seo as ShowcaseSeo | null) ?? null,
    publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
    sections: s.sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      position: sec.position,
      hidden: sec.hidden,
      items: sec.items.map(serializeItem),
    })),
  };
}

/** Next position in a list (append). */
async function nextSectionPosition(showcaseId: string): Promise<number> {
  const last = await prisma.showcaseSection.findFirst({
    where: { showcaseId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}
async function nextItemPosition(sectionId: string): Promise<number> {
  const last = await prisma.showcaseItem.findFirst({
    where: { sectionId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}

// ── List + create ─────────────────────────────────────────────────────────────
showcaseRouter.get("/api/showcases", requireAuth, requireWorkspace, async (req, res) => {
  const rows = await prisma.showcase.findMany({
    where: { organizationId: req.workspace!.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      layout: true,
      status: true,
      updatedAt: true,
      sections: { select: { _count: { select: { items: true } } } },
    },
  });
  const showcases: ShowcaseCard[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    layout: r.layout,
    status: r.status,
    itemCount: r.sections.reduce((n, s) => n + s._count.items, 0),
    updatedAt: r.updatedAt.toISOString(),
  }));
  res.json({ showcases });
});

showcaseRouter.post("/api/showcases", requireAuth, requireWorkspace, async (req, res) => {
  const { title } = createShowcaseSchema.parse(req.body);
  const slug = await uniqueSlug(
    title,
    async (s) => !!(await prisma.showcase.findFirst({ where: { slug: s }, select: { id: true } }))
  );
  const sc = await prisma.showcase.create({
    data: {
      organizationId: req.workspace!.id,
      title,
      slug,
      // Start with one section so the builder isn't empty.
      sections: { create: { title: "Section 1", position: 0 } },
    },
    select: { id: true },
  });
  res.status(201).json({ detail: await loadDetail(sc.id) });
});

// ── Detail / settings / delete / publish ────────────────────────────────────
showcaseRouter.get("/api/showcases/:id", requireAuth, requireWorkspace, async (req, res) => {
  const { id } = idParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  res.json({ detail: await loadDetail(id) });
});

showcaseRouter.patch("/api/showcases/:id", requireAuth, requireWorkspace, async (req, res) => {
  const { id } = idParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  const input = updateShowcaseSchema.parse(req.body);
  if (input.slug) {
    const clash = await prisma.showcase.findFirst({
      where: { slug: input.slug, id: { not: id } },
      select: { id: true },
    });
    if (clash) throw new AppError(409, "SLUG_TAKEN", "That address is taken");
  }
  await prisma.showcase.update({
    where: { id },
    data: { ...input, seo: (input.seo ?? undefined) as Prisma.InputJsonValue | undefined },
  });
  res.json({ detail: await loadDetail(id) });
});

showcaseRouter.delete("/api/showcases/:id", requireAuth, requireWorkspace, async (req, res) => {
  const { id } = idParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  await prisma.showcase.delete({ where: { id } });
  res.json({ ok: true });
});

showcaseRouter.post("/api/showcases/:id/publish", requireAuth, requireWorkspace, async (req, res) => {
  const { id } = idParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  await prisma.showcase.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  res.json({ detail: await loadDetail(id) });
});

showcaseRouter.post("/api/showcases/:id/unpublish", requireAuth, requireWorkspace, async (req, res) => {
  const { id } = idParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  await prisma.showcase.update({ where: { id }, data: { status: "DRAFT" } });
  res.json({ detail: await loadDetail(id) });
});

// ── Sections ─────────────────────────────────────────────────────────────────
showcaseRouter.post("/api/showcases/:id/sections", requireAuth, requireWorkspace, async (req, res) => {
  const { id } = idParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  const { title } = createSectionSchema.parse(req.body);
  await prisma.showcaseSection.create({
    data: { showcaseId: id, title, position: await nextSectionPosition(id) },
  });
  res.status(201).json({ detail: await loadDetail(id) });
});

showcaseRouter.patch("/api/showcases/:id/sections/:sid", requireAuth, requireWorkspace, async (req, res) => {
  const { id, sid } = sectionParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  await assertSection(id, sid);
  const input = updateSectionSchema.parse(req.body);
  await prisma.showcaseSection.update({ where: { id: sid }, data: input });
  res.json({ detail: await loadDetail(id) });
});

showcaseRouter.delete("/api/showcases/:id/sections/:sid", requireAuth, requireWorkspace, async (req, res) => {
  const { id, sid } = sectionParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  await assertSection(id, sid);
  await prisma.showcaseSection.delete({ where: { id: sid } });
  res.json({ detail: await loadDetail(id) });
});

showcaseRouter.post("/api/showcases/:id/sections/reorder", requireAuth, requireWorkspace, async (req, res) => {
  const { id } = idParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  const { ids } = reorderSchema.parse(req.body);
  const owned = await prisma.showcaseSection.findMany({
    where: { id: { in: ids }, showcaseId: id },
    select: { id: true },
  });
  const set = new Set(owned.map((s) => s.id));
  await prisma.$transaction(
    ids.filter((x) => set.has(x)).map((x, position) => prisma.showcaseSection.update({ where: { id: x }, data: { position } }))
  );
  res.json({ detail: await loadDetail(id) });
});

// ── Items ────────────────────────────────────────────────────────────────────
// Add published guides (each becomes a GUIDE item).
showcaseRouter.post("/api/showcases/:id/sections/:sid/guides", requireAuth, requireWorkspace, async (req, res) => {
  const { id, sid } = sectionParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  await assertSection(id, sid);
  const { guideIds } = addGuidesSchema.parse(req.body);
  const guides = await prisma.guide.findMany({
    where: { id: { in: guideIds }, organizationId: req.workspace!.id, status: "PUBLISHED", deletedAt: null },
    select: { id: true },
  });
  const valid = new Set(guides.map((g) => g.id));
  let position = await nextItemPosition(sid);
  const rows: Prisma.ShowcaseItemCreateManyInput[] = guideIds
    .filter((g) => valid.has(g))
    .map((guideId) => ({ sectionId: sid, type: "GUIDE" as const, guideId, position: position++ }));
  if (rows.length) await prisma.showcaseItem.createMany({ data: rows });
  res.status(201).json({ detail: await loadDetail(id) });
});

// Add a single resource item (video / pdf / link / form).
showcaseRouter.post("/api/showcases/:id/sections/:sid/resource", requireAuth, requireWorkspace, async (req, res) => {
  const { id, sid } = sectionParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  await assertSection(id, sid);
  const input = addResourceSchema.parse(req.body);
  const position = await nextItemPosition(sid);
  await prisma.showcaseItem.create({
    data: {
      sectionId: sid,
      type: input.type.toUpperCase() as Prisma.ShowcaseItemCreateInput["type"],
      position,
      title: input.title ?? null,
      url: input.type === "form" ? null : input.url,
      formShareId: input.type === "form" ? input.formShareId : null,
    },
  });
  res.status(201).json({ detail: await loadDetail(id) });
});

showcaseRouter.patch("/api/showcases/:id/items/:iid", requireAuth, requireWorkspace, async (req, res) => {
  const { id, iid } = itemParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  const item = await prisma.showcaseItem.findFirst({
    where: { id: iid, section: { showcaseId: id } },
    select: { id: true },
  });
  if (!item) throw new AppError(404, "NOT_FOUND", "Item not found");
  const input = updateItemSchema.parse(req.body);
  await prisma.showcaseItem.update({ where: { id: iid }, data: input });
  res.json({ detail: await loadDetail(id) });
});

showcaseRouter.delete("/api/showcases/:id/items/:iid", requireAuth, requireWorkspace, async (req, res) => {
  const { id, iid } = itemParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  const item = await prisma.showcaseItem.findFirst({
    where: { id: iid, section: { showcaseId: id } },
    select: { id: true },
  });
  if (!item) throw new AppError(404, "NOT_FOUND", "Item not found");
  await prisma.showcaseItem.delete({ where: { id: iid } });
  res.json({ detail: await loadDetail(id) });
});

showcaseRouter.post("/api/showcases/:id/sections/:sid/items/reorder", requireAuth, requireWorkspace, async (req, res) => {
  const { id, sid } = sectionParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  await assertSection(id, sid);
  const { ids } = reorderSchema.parse(req.body);
  const owned = await prisma.showcaseItem.findMany({
    where: { id: { in: ids }, sectionId: sid },
    select: { id: true },
  });
  const set = new Set(owned.map((i) => i.id));
  await prisma.$transaction(
    ids.filter((x) => set.has(x)).map((x, position) => prisma.showcaseItem.update({ where: { id: x }, data: { position } }))
  );
  res.json({ detail: await loadDetail(id) });
});

// ── Guide picker ──────────────────────────────────────────────────────────────
const availableQuery = z.object({ q: z.string().trim().max(80).optional() });
showcaseRouter.get("/api/showcases/:id/available-guides", requireAuth, requireWorkspace, async (req, res) => {
  const { id } = idParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  const { q } = availableQuery.parse(req.query);
  const guides = await prisma.guide.findMany({
    where: {
      organizationId: req.workspace!.id,
      status: "PUBLISHED",
      deletedAt: null,
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, _count: { select: { blocks: { where: { type: "STEP" as const } } } } },
  });
  res.json({
    guides: guides.map((g) => ({ id: g.id, title: g.title, stepCount: g._count.blocks })),
  });
});

// ── Analytics ──────────────────────────────────────────────────────────────────
const analyticsQuerySchema = z.object({ range: analyticsRangeSchema.optional() });
showcaseRouter.get("/api/showcases/:id/analytics", requireAuth, requireWorkspace, async (req, res) => {
  const { id } = idParam.parse(req.params);
  await assertShowcase(id, req.workspace!.id);
  const { range = "30d" } = analyticsQuerySchema.parse(req.query);
  const days = ANALYTICS_RANGE_DAYS[range];
  const now = new Date();
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const [events, sc] = await Promise.all([
    prisma.showcaseEvent.findMany({
      where: { showcaseId: id, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { type: true, anonId: true, sessionId: true, target: true, createdAt: true },
    }),
    prisma.showcase.findUnique({
      where: { id },
      select: {
        sections: {
          select: { items: { select: { id: true, title: true, guide: { select: { title: true } } } } },
        },
      },
    }),
  ]);

  // itemId → display title (matches the public payload's title resolution).
  const itemTitles: Record<string, string> = {};
  for (const sec of sc?.sections ?? []) {
    for (const it of sec.items) itemTitles[it.id] = it.title || it.guide?.title || "Untitled";
  }

  const analytics = computeShowcaseAnalytics(events as ShowcaseEventRow[], itemTitles, days, now, {
    range,
  });
  res.json({ analytics });
});
