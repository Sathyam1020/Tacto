import {
  addArticlesSchema,
  createCollectionSchema,
  estimateReadMinutes,
  featureSchema,
  helpCenterSettingsSchema,
  reorderSchema,
  updateCollectionSchema,
  type HelpArticleCard,
  type HelpCenterDetail,
  type HelpCollectionDetail,
  type HelpNavLink,
  type HelpSeo,
} from "@workspace/contracts/help-center";
import { ensureHelpCenter, Prisma, prisma } from "@workspace/db";
import { Router } from "express";
import { z } from "zod";

import { generateSlug } from "../../lib/slug.js";
import { AppError } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";
import { uniqueSlug } from "./slug.js";

const idParamSchema = z.object({ id: z.string() });

/** Help Center — owner (authenticated) management. An article is always a
 *  published guide; these endpoints manage organization/branding/navigation
 *  only. Public read + search live in the public router. */
export const helpCenterRouter: Router = Router();

// ── helpers ──────────────────────────────────────────────────────────────
/** Get-or-create the workspace's Help Center, returning its id. */
async function helpCenterId(organizationId: string, name: string): Promise<string> {
  return ensureHelpCenter(prisma, organizationId, {
    name: `${name} Help Center`,
    slug: generateSlug(name),
  });
}

/** Resolve a collection that belongs to this workspace's help center, or 404. */
async function assertCollection(id: string, organizationId: string) {
  const collection = await prisma.helpCollection.findFirst({
    where: { id, helpCenter: { organizationId } },
    select: { id: true, helpCenterId: true },
  });
  if (!collection) throw new AppError(404, "NOT_FOUND", "Collection not found");
  return collection;
}

const guideCardSelect = {
  id: true,
  title: true,
  summary: true,
  status: true,
  _count: { select: { blocks: { where: { type: "STEP" as const } } } },
} as const;

type ArticleRow = {
  id: string;
  guideId: string;
  slug: string;
  featured: boolean;
  titleOverride: string | null;
  guide: {
    id: string;
    title: string;
    summary: string | null;
    status: "DRAFT" | "PUBLISHED";
    _count: { blocks: number };
  };
};

function toCard(a: ArticleRow): HelpArticleCard {
  const stepCount = a.guide._count.blocks;
  return {
    id: a.id,
    guideId: a.guideId,
    title: a.titleOverride ?? a.guide.title,
    excerpt: a.guide.summary,
    readMinutes: estimateReadMinutes(stepCount),
    featured: a.featured,
    slug: a.slug,
    status: a.guide.status,
    stepCount,
  };
}

/** The full owner detail payload (center + collections + article cards). */
async function loadDetail(hcId: string): Promise<HelpCenterDetail> {
  const hc = await prisma.helpCenter.findUniqueOrThrow({
    where: { id: hcId },
    include: {
      collections: {
        orderBy: { position: "asc" },
        include: {
          articles: {
            orderBy: { position: "asc" },
            include: { guide: { select: guideCardSelect } },
          },
        },
      },
    },
  });
  const collections: HelpCollectionDetail[] = hc.collections.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    icon: c.icon,
    slug: c.slug,
    position: c.position,
    hidden: c.hidden,
    articles: c.articles.map(toCard),
  }));
  return {
    id: hc.id,
    slug: hc.slug,
    status: hc.status,
    listed: hc.listed,
    name: hc.name,
    logoUrl: hc.logoUrl,
    brandColor: hc.brandColor,
    theme: hc.theme,
    faviconUrl: hc.faviconUrl,
    heroTitle: hc.heroTitle,
    heroSubtitle: hc.heroSubtitle,
    navLinks: (hc.navLinks as HelpNavLink[] | null) ?? [],
    footerLinks: (hc.footerLinks as HelpNavLink[] | null) ?? [],
    contactFormId: hc.contactFormId,
    statusUrl: hc.statusUrl,
    seo: (hc.seo as HelpSeo | null) ?? null,
    publishedAt: hc.publishedAt ? hc.publishedAt.toISOString() : null,
    collections,
  };
}

// ── Get-or-create + detail ─────────────────────────────────────────────────
helpCenterRouter.get("/api/help-center", requireAuth, requireWorkspace, async (req, res) => {
  const ws = req.workspace!;
  const hcId = await helpCenterId(ws.id, ws.name);
  res.json({ helpCenter: await loadDetail(hcId) });
});

// ── Settings / branding ────────────────────────────────────────────────────
helpCenterRouter.patch("/api/help-center", requireAuth, requireWorkspace, async (req, res) => {
  const ws = req.workspace!;
  const input = helpCenterSettingsSchema.parse(req.body);
  const hcId = await helpCenterId(ws.id, ws.name);

  if (input.slug) {
    const clash = await prisma.helpCenter.findFirst({
      where: { slug: input.slug, id: { not: hcId } },
      select: { id: true },
    });
    if (clash) throw new AppError(409, "SLUG_TAKEN", "That address is taken");
  }

  await prisma.helpCenter.update({
    where: { id: hcId },
    data: {
      ...input,
      navLinks: input.navLinks as Prisma.InputJsonValue | undefined,
      footerLinks: input.footerLinks as Prisma.InputJsonValue | undefined,
      seo: (input.seo ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  res.json({ helpCenter: await loadDetail(hcId) });
});

// ── Publish (draft → live) ─────────────────────────────────────────────────
helpCenterRouter.post("/api/help-center/publish", requireAuth, requireWorkspace, async (req, res) => {
  const ws = req.workspace!;
  const hcId = await helpCenterId(ws.id, ws.name);
  const hc = await prisma.helpCenter.update({
    where: { id: hcId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    select: { status: true, publishedAt: true, slug: true },
  });
  res.json({ helpCenter: hc });
});

// ── Collections ─────────────────────────────────────────────────────────────
helpCenterRouter.post(
  "/api/help-center/collections",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const ws = req.workspace!;
    const input = createCollectionSchema.parse(req.body);
    const hcId = await helpCenterId(ws.id, ws.name);

    const slug = await uniqueSlug(input.name, async (s) =>
      !!(await prisma.helpCollection.findFirst({
        where: { helpCenterId: hcId, slug: s },
        select: { id: true },
      }))
    );
    const last = await prisma.helpCollection.findFirst({
      where: { helpCenterId: hcId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const collection = await prisma.helpCollection.create({
      data: {
        helpCenterId: hcId,
        name: input.name,
        description: input.description ?? null,
        icon: input.icon ?? null,
        slug,
        position: (last?.position ?? -1) + 1,
      },
      select: { id: true },
    });
    res.status(201).json({ collectionId: collection.id, detail: await loadDetail(hcId) });
  }
);

helpCenterRouter.patch(
  "/api/help-center/collections/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateCollectionSchema.parse(req.body);
    const col = await assertCollection(id, req.workspace!.id);
    await prisma.helpCollection.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        icon: input.icon,
        hidden: input.hidden,
      },
    });
    res.json({ detail: await loadDetail(col.helpCenterId) });
  }
);

helpCenterRouter.delete(
  "/api/help-center/collections/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const col = await assertCollection(id, req.workspace!.id);
    await prisma.helpCollection.delete({ where: { id } });
    res.json({ detail: await loadDetail(col.helpCenterId) });
  }
);

helpCenterRouter.post(
  "/api/help-center/collections/reorder",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const ws = req.workspace!;
    const { ids } = reorderSchema.parse(req.body);
    const hcId = await helpCenterId(ws.id, ws.name);
    // Only reorder collections that belong to this help center.
    const owned = await prisma.helpCollection.findMany({
      where: { id: { in: ids }, helpCenterId: hcId },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((c) => c.id));
    await prisma.$transaction(
      ids
        .filter((id) => ownedSet.has(id))
        .map((id, position) =>
          prisma.helpCollection.update({ where: { id }, data: { position } })
        )
    );
    res.json({ detail: await loadDetail(hcId) });
  }
);

helpCenterRouter.post(
  "/api/help-center/collections/:id/duplicate",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const col = await assertCollection(id, req.workspace!.id);
    const source = await prisma.helpCollection.findUniqueOrThrow({
      where: { id },
      include: { articles: { orderBy: { position: "asc" } } },
    });
    const name = `Copy of ${source.name}`;
    const slug = await uniqueSlug(name, async (s) =>
      !!(await prisma.helpCollection.findFirst({
        where: { helpCenterId: col.helpCenterId, slug: s },
        select: { id: true },
      }))
    );
    const last = await prisma.helpCollection.findFirst({
      where: { helpCenterId: col.helpCenterId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const created = await prisma.helpCollection.create({
      data: {
        helpCenterId: col.helpCenterId,
        name,
        description: source.description,
        icon: source.icon,
        hidden: source.hidden,
        slug,
        position: (last?.position ?? -1) + 1,
        // Article slugs are unique per collection, so the source slugs are free.
        articles: {
          create: source.articles.map((a) => ({
            guideId: a.guideId,
            slug: a.slug,
            position: a.position,
            featured: a.featured,
            titleOverride: a.titleOverride,
          })),
        },
      },
      select: { id: true },
    });
    res.status(201).json({ collectionId: created.id, detail: await loadDetail(col.helpCenterId) });
  }
);

// ── Articles (placements over published guides) ─────────────────────────────
helpCenterRouter.post(
  "/api/help-center/collections/:id/articles",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { guideIds } = addArticlesSchema.parse(req.body);
    const col = await assertCollection(id, req.workspace!.id);

    // Only PUBLISHED guides in this workspace can be articles.
    const guides = await prisma.guide.findMany({
      where: {
        id: { in: guideIds },
        organizationId: req.workspace!.id,
        status: "PUBLISHED",
        deletedAt: null,
      },
      select: { id: true, title: true },
    });
    const existing = new Set(
      (
        await prisma.helpArticle.findMany({
          where: { collectionId: id, guideId: { in: guides.map((g) => g.id) } },
          select: { guideId: true },
        })
      ).map((a) => a.guideId)
    );
    const last = await prisma.helpArticle.findFirst({
      where: { collectionId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    let position = (last?.position ?? -1) + 1;
    for (const g of guides) {
      if (existing.has(g.id)) continue;
      const slug = await uniqueSlug(g.title, async (s) =>
        !!(await prisma.helpArticle.findFirst({
          where: { collectionId: id, slug: s },
          select: { id: true },
        }))
      );
      await prisma.helpArticle.create({
        data: { collectionId: id, guideId: g.id, slug, position: position++ },
      });
    }
    res.status(201).json({ detail: await loadDetail(col.helpCenterId) });
  }
);

helpCenterRouter.delete(
  "/api/help-center/articles/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const article = await prisma.helpArticle.findFirst({
      where: { id, collection: { helpCenter: { organizationId: req.workspace!.id } } },
      select: { id: true, collection: { select: { helpCenterId: true } } },
    });
    if (!article) throw new AppError(404, "NOT_FOUND", "Article not found");
    await prisma.helpArticle.delete({ where: { id } });
    res.json({ detail: await loadDetail(article.collection.helpCenterId) });
  }
);

helpCenterRouter.post(
  "/api/help-center/articles/reorder",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { ids } = reorderSchema.parse(req.body);
    const owned = await prisma.helpArticle.findMany({
      where: { id: { in: ids }, collection: { helpCenter: { organizationId: req.workspace!.id } } },
      select: { id: true, collection: { select: { helpCenterId: true } } },
    });
    if (owned.length === 0) throw new AppError(404, "NOT_FOUND", "No articles found");
    const ownedSet = new Set(owned.map((a) => a.id));
    await prisma.$transaction(
      ids
        .filter((id) => ownedSet.has(id))
        .map((id, position) =>
          prisma.helpArticle.update({ where: { id }, data: { position } })
        )
    );
    res.json({ detail: await loadDetail(owned[0]!.collection.helpCenterId) });
  }
);

helpCenterRouter.post(
  "/api/help-center/articles/:id/feature",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { featured } = featureSchema.parse(req.body);
    const article = await prisma.helpArticle.findFirst({
      where: { id, collection: { helpCenter: { organizationId: req.workspace!.id } } },
      select: { id: true, collection: { select: { helpCenterId: true } } },
    });
    if (!article) throw new AppError(404, "NOT_FOUND", "Article not found");
    await prisma.helpArticle.update({ where: { id }, data: { featured } });
    res.json({ detail: await loadDetail(article.collection.helpCenterId) });
  }
);

// ── Guide picker: published guides available to add ─────────────────────────
helpCenterRouter.get(
  "/api/help-center/available-guides",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const guides = await prisma.guide.findMany({
      where: {
        organizationId: req.workspace!.id,
        status: "PUBLISHED",
        deletedAt: null,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, _count: { select: { blocks: { where: { type: "STEP" } } } } },
    });
    res.json({
      guides: guides.map((g) => ({
        id: g.id,
        title: g.title,
        stepCount: g._count.blocks,
      })),
    });
  }
);
