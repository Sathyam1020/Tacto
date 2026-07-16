import {
  estimateReadMinutes,
  type HelpNavLink,
  type HelpSearchHit,
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
 * Public, unauthenticated Help Center by slug. Reachable as soon as it exists
 * (so owners can preview), but `noindex` until published + listed. Only
 * PUBLISHED guides appear as articles; hidden collections are omitted. Article
 * content is served by the existing public guide endpoint (this returns the
 * guide's shareId) — the Guide Reader renders it, so walkthrough / voiceover /
 * FAQs / forms / PDF / translations all keep working.
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

/**
 * A help center is reachable by its (unguessable) slug as soon as it exists —
 * so the owner can preview it before publishing. `status`/`listed` only control
 * search-engine indexing: the page is `noindex` until published + listed.
 */
async function findCenter(slug: string) {
  const hc = await prisma.helpCenter.findFirst({
    where: { slug },
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
      status: true,
      listed: true,
    },
  });
  if (!hc) throw new AppError(404, "NOT_FOUND", "Help center not found");
  return hc;
}

function chromeOf(hc: Awaited<ReturnType<typeof findCenter>>): PublicHelpChrome {
  return {
    slug: hc.slug,
    name: hc.name,
    logoUrl: hc.logoUrl,
    brandColor: hc.brandColor,
    theme: hc.theme,
    navLinks: (hc.navLinks as HelpNavLink[] | null) ?? [],
    footerLinks: (hc.footerLinks as HelpNavLink[] | null) ?? [],
    statusUrl: hc.statusUrl,
    noindex: hc.status !== "PUBLISHED" || !hc.listed,
  };
}

// ── Homepage ────────────────────────────────────────────────────────────────
helpPublicRouter.get("/api/public/help/:slug", async (req, res) => {
  const { slug } = slugParam.parse(req.params);
  const hc = await findCenter(slug);

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

// ── Search (Postgres full-text over the center's published articles) ────────
// Registered BEFORE `:slug/:cslug` so "search" isn't matched as a collection
// slug. Ranks title (A) > summary (B) > step content (C); featured articles get
// a small boost; `ts_headline` yields a plain-text snippet the client highlights.
const searchParam = z.object({ slug: z.string().min(1) });
const searchQuery = z.object({ q: z.string().trim().max(200).optional() });

type SearchRow = {
  title: string;
  excerpt: string | null;
  slug: string;
  collectionSlug: string;
  collectionName: string;
};

helpPublicRouter.get("/api/public/help/:slug/search", async (req, res) => {
  const { slug } = searchParam.parse(req.params);
  const { q } = searchQuery.parse(req.query);
  await findCenter(slug); // 404 if the center doesn't exist (preview parity)

  const term = (q ?? "").trim();
  if (!term) {
    res.json({ hits: [] as HelpSearchHit[] });
    return;
  }

  // Scope: articles of visible collections in this center whose guide is
  // published + not deleted. Step HTML is stripped to plain text for indexing.
  const rows = await prisma.$queryRaw<SearchRow[]>`
    WITH arts AS (
      SELECT
        a.slug                          AS article_slug,
        col.slug                        AS collection_slug,
        col.name                        AS collection_name,
        coalesce(a."titleOverride", g.title) AS title,
        g.summary                       AS summary,
        a.featured                      AS featured,
        coalesce(
          (SELECT string_agg(regexp_replace(s.content, '<[^>]+>', ' ', 'g'), ' ')
             FROM step s
            WHERE s."guideId" = g.id AND s.type = 'STEP'),
          ''
        )                               AS body
      FROM help_article a
      JOIN help_collection col ON col.id = a."collectionId"
      JOIN help_center hc      ON hc.id = col."helpCenterId"
      JOIN guide g             ON g.id = a."guideId"
      WHERE hc.slug = ${slug}
        AND col.hidden = false
        AND g.status = 'PUBLISHED'
        AND g."deletedAt" IS NULL
    ),
    ranked AS (
      SELECT
        article_slug, collection_slug, collection_name, title, summary, featured, body,
        setweight(to_tsvector('english', coalesce(title, '')),   'A')
          || setweight(to_tsvector('english', coalesce(summary, '')), 'B')
          || setweight(to_tsvector('english', coalesce(body, '')),    'C') AS doc,
        websearch_to_tsquery('english', ${term}) AS query
      FROM arts
    )
    SELECT
      title                           AS "title",
      article_slug                    AS "slug",
      collection_slug                 AS "collectionSlug",
      collection_name                 AS "collectionName",
      nullif(
        ts_headline(
          'english',
          coalesce(title, '') || '. ' || coalesce(summary, '') || ' ' || coalesce(body, ''),
          query,
          'StartSel="",StopSel="",MaxWords=28,MinWords=12,MaxFragments=1,ShortWord=2'
        ),
        ''
      )                               AS "excerpt"
    FROM ranked
    WHERE doc @@ query
    ORDER BY ts_rank(doc, query) + (CASE WHEN featured THEN 0.3 ELSE 0 END) DESC
    LIMIT 20
  `;

  const hits: HelpSearchHit[] = rows.map((r) => ({
    title: r.title,
    excerpt: r.excerpt ?? "",
    slug: r.slug,
    collectionSlug: r.collectionSlug,
    collectionName: r.collectionName,
  }));
  res.json({ hits });
});

// ── Collection ──────────────────────────────────────────────────────────────
helpPublicRouter.get("/api/public/help/:slug/:cslug", async (req, res) => {
  const { slug, cslug } = collectionParam.parse(req.params);
  const hc = await findCenter(slug);

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
  const hc = await findCenter(slug);

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
