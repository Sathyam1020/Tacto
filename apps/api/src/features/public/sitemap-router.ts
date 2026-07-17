import { prisma } from "@workspace/db";
import { Router } from "express";

/**
 * Public sitemap feed — the URLs Google should index: published guides, and
 * published + listed showcases and help centers (the same gate the public
 * pages use for `noindex`). The web app's `sitemap.ts` consumes this and emits
 * `/sitemap.xml`. No auth; read-only; cheap id/slug selects.
 */
export const sitemapRouter: Router = Router();

sitemapRouter.get("/api/public/sitemap", async (_req, res) => {
  const [guides, showcases, helpCenters] = await Promise.all([
    prisma.guide.findMany({
      where: { status: "PUBLISHED", shareId: { not: null }, deletedAt: null },
      select: { shareId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
    prisma.showcase.findMany({
      where: { status: "PUBLISHED", listed: true },
      select: { slug: true, updatedAt: true },
      take: 5000,
    }),
    prisma.helpCenter.findMany({
      where: { status: "PUBLISHED", listed: true },
      select: { slug: true, updatedAt: true },
      take: 1000,
    }),
  ]);

  // Cache at the edge for an hour — the sitemap doesn't need to be real-time.
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.json({
    guides: guides.map((g) => ({ shareId: g.shareId, updatedAt: g.updatedAt.toISOString() })),
    showcases: showcases.map((s) => ({ slug: s.slug, updatedAt: s.updatedAt.toISOString() })),
    helpCenters: helpCenters.map((h) => ({ slug: h.slug, updatedAt: h.updatedAt.toISOString() })),
  });
});
