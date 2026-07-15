import {
  estimateReadMinutes,
  type HelpNavLink,
  type PublicHelpArticle,
  type PublicHelpArticlePage,
  type PublicHelpCenter,
  type PublicHelpChrome,
  type PublicHelpCollection,
  type PublicHelpCollectionPage,
} from "@workspace/contracts/help-center";
import { prisma } from "@workspace/db";
import { Router } from "express";
import { z } from "zod";

import { AppError } from "../../middleware/error.js";

/**
 * Public, unauthenticated Help Center by slug. Only PUBLISHED help centers are
 * visible; only PUBLISHED guides appear as articles; hidden collections are
 * omitted. Article content is served by the existing public guide endpoint
 * (this returns the guide's shareId) — the Guide Reader renders it, so
 * walkthrough / voiceover / FAQs / forms / PDF / translations all work.
 */
export const helpPublicRouter: Router = Router();

const slugParam = z.object({ slug: z.string().min(1) });
const collectionParam = z.object({ slug: z.string().min(1), cslug: z.string().min(1) });
const articleParam = z.object({
  slug: z.string().min(1),
  cslug: z.string().min(1),
  aslug: z.string().min(1),
});

const guideCardSelect = {
  title: true,
  summary: true,
  _count: { select: { blocks: { where: { type: "STEP" as const } } } },
} as const;

type ArticleWithGuide = {
  slug: string;
  featured: boolean;
  titleOverride: string | null;
  guide: {
    title: string;
    summary: string | null;
    _count: { blocks: number };
  };
};

function toPublicArticle(a: ArticleWithGuide, collectionSlug: string): PublicHelpArticle {
  return {
    title: a.titleOverride ?? a.guide.title,
    excerpt: a.guide.summary,
    readMinutes: estimateReadMinutes(a.guide._count.blocks),
    slug: a.slug,
    collectionSlug,
  };
}

/** Only articles whose guide is published + not deleted are public. */
const publicArticleWhere = {
  guide: { status: "PUBLISHED" as const, deletedAt: null },
};

async function findPublishedCenter(slug: string) {
  const hc = await prisma.helpCenter.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      brandColor: true,
      theme: true,
      heroTitle: true,
      heroSubtitle: true,
      navLinks: true,
      footerLinks: true,
      statusUrl: true,
    },
  });
  if (!hc) throw new AppError(404, "NOT_FOUND", "Help center not found");
  return hc;
}

function chromeOf(hc: Awaited<ReturnType<typeof findPublishedCenter>>): PublicHelpChrome {
  return {
    slug: hc.slug,
    name: hc.name,
    logoUrl: hc.logoUrl,
    brandColor: hc.brandColor,
    theme: hc.theme,
    navLinks: (hc.navLinks as HelpNavLink[] | null) ?? [],
    footerLinks: (hc.footerLinks as HelpNavLink[] | null) ?? [],
    statusUrl: hc.statusUrl,
  };
}

// ── Homepage ────────────────────────────────────────────────────────────────
helpPublicRouter.get("/api/public/help/:slug", async (req, res) => {
  const { slug } = slugParam.parse(req.params);
  const hc = await findPublishedCenter(slug);

  const collections = await prisma.helpCollection.findMany({
    where: { helpCenter: { slug }, hidden: false },
    orderBy: { position: "asc" },
    select: {
      name: true,
      description: true,
      icon: true,
      slug: true,
      articles: {
        where: publicArticleWhere,
        orderBy: { position: "asc" },
        select: { slug: true, featured: true, titleOverride: true, guide: { select: guideCardSelect } },
      },
    },
  });

  const publicCollections: PublicHelpCollection[] = collections.map((c) => ({
    name: c.name,
    description: c.description,
    icon: c.icon,
    slug: c.slug,
    count: c.articles.length,
    articles: c.articles.map((a) => toPublicArticle(a, c.slug)),
  }));
  const featured: PublicHelpArticle[] = collections.flatMap((c) =>
    c.articles.filter((a) => a.featured).map((a) => toPublicArticle(a, c.slug))
  );

  const payload: PublicHelpCenter = {
    ...chromeOf(hc),
    heroTitle: hc.heroTitle,
    heroSubtitle: hc.heroSubtitle,
    collections: publicCollections,
    featured,
  };
  res.json({ helpCenter: payload });
});

// ── Collection ──────────────────────────────────────────────────────────────
helpPublicRouter.get("/api/public/help/:slug/:cslug", async (req, res) => {
  const { slug, cslug } = collectionParam.parse(req.params);
  const hc = await findPublishedCenter(slug);

  const collection = await prisma.helpCollection.findFirst({
    where: { helpCenter: { slug }, slug: cslug, hidden: false },
    select: {
      name: true,
      description: true,
      icon: true,
      slug: true,
      articles: {
        where: publicArticleWhere,
        orderBy: { position: "asc" },
        select: { slug: true, featured: true, titleOverride: true, guide: { select: guideCardSelect } },
      },
    },
  });
  if (!collection) throw new AppError(404, "NOT_FOUND", "Collection not found");

  const siblings = await prisma.helpCollection.findMany({
    where: { helpCenter: { slug }, hidden: false },
    orderBy: { position: "asc" },
    select: { name: true, slug: true, icon: true },
  });

  const payload: PublicHelpCollectionPage = {
    chrome: chromeOf(hc),
    collection: {
      name: collection.name,
      description: collection.description,
      icon: collection.icon,
      slug: collection.slug,
      count: collection.articles.length,
      articles: collection.articles.map((a) => toPublicArticle(a, collection.slug)),
    },
    siblings,
  };
  res.json({ page: payload });
});

// ── Article (→ guide shareId for the Guide Reader) ──────────────────────────
helpPublicRouter.get("/api/public/help/:slug/:cslug/:aslug", async (req, res) => {
  const { slug, cslug, aslug } = articleParam.parse(req.params);
  const hc = await findPublishedCenter(slug);

  const article = await prisma.helpArticle.findFirst({
    where: {
      slug: aslug,
      collection: { slug: cslug, hidden: false, helpCenter: { slug } },
      guide: { status: "PUBLISHED", deletedAt: null },
    },
    select: {
      slug: true,
      titleOverride: true,
      guide: { select: { title: true, shareId: true } },
      collection: {
        select: {
          name: true,
          slug: true,
          articles: {
            where: publicArticleWhere,
            orderBy: { position: "asc" },
            select: { slug: true, featured: true, titleOverride: true, guide: { select: guideCardSelect } },
          },
        },
      },
    },
  });
  if (!article || !article.guide.shareId) {
    throw new AppError(404, "NOT_FOUND", "Article not found");
  }

  const related = article.collection.articles
    .filter((a) => a.slug !== article.slug)
    .slice(0, 4)
    .map((a) => toPublicArticle(a, article.collection.slug));

  const payload: PublicHelpArticlePage = {
    chrome: chromeOf(hc),
    collection: { name: article.collection.name, slug: article.collection.slug },
    article: { title: article.titleOverride ?? article.guide.title, slug: article.slug },
    guideShareId: article.guide.shareId,
    related,
  };
  res.json({ page: payload });
});
