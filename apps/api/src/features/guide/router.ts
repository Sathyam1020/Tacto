import {
  guideCustomizationSchema,
  moveGuideSchema,
  setGuideFolderSchema,
  updateGuideSchema,
} from "@workspace/contracts/guide";
import { ensureDefaultFolder, prisma } from "@workspace/db";
import { presignGet } from "@workspace/storage";
import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";

import { sanitizeContent } from "../../lib/sanitize.js";
import { AppError } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";
import {
  blockSelect,
  serializeBlocks,
  serializeCustomization,
} from "./serialize.js";

const idParamSchema = z.object({ id: z.string() });

/** Guides — workspace-scoped read + edit + publish. */
export const guideRouter: Router = Router();

// ── List ─────────────────────────────────────────────────────────────────
guideRouter.get(
  "/api/guides",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const guides = await prisma.guide.findMany({
      where: { organizationId: req.workspace!.id, deletedAt: null },
      // Pinned guides float to the top; then newest first.
      orderBy: [
        { pinnedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        title: true,
        summary: true,
        status: true,
        shareId: true,
        pinnedAt: true,
        viewCount: true,
        folderId: true,
        captureId: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { name: true, image: true } },
        _count: { select: { blocks: { where: { type: "STEP" } } } },
        // First STEP block with a screenshot → card cover.
        blocks: {
          where: { type: "STEP", screenshotUrl: { not: null } },
          orderBy: { position: "asc" },
          take: 1,
          select: { screenshotUrl: true },
        },
      },
    });

    res.json({
      guides: await Promise.all(
        guides.map(async (guide) => {
          const coverKey = guide.blocks[0]?.screenshotUrl ?? null;
          return {
            id: guide.id,
            title: guide.title,
            summary: guide.summary,
            status: guide.status,
            shareId: guide.shareId,
            stepCount: guide._count.blocks,
            coverUrl: coverKey ? await presignGet(coverKey) : null,
            pinnedAt: guide.pinnedAt,
            viewCount: guide.viewCount,
            folderId: guide.folderId,
            aiGenerated: guide.captureId !== null,
            author: {
              name: guide.createdBy.name,
              image: guide.createdBy.image,
            },
            createdAt: guide.createdAt,
            updatedAt: guide.updatedAt,
          };
        })
      ),
    });
  }
);

// ── Detail ───────────────────────────────────────────────────────────────
guideRouter.get(
  "/api/guides/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      include: {
        capture: { select: { source: true } },
        blocks: { orderBy: { position: "asc" }, select: blockSelect },
      },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    res.json({
      guide: {
        id: guide.id,
        title: guide.title,
        summary: guide.summary,
        status: guide.status,
        shareId: guide.shareId,
        publishedAt: guide.publishedAt,
        viewCount: guide.viewCount,
        captureSource: guide.capture?.source ?? null,
        createdAt: guide.createdAt,
        customization: await serializeCustomization(guide.customization),
        blocks: await serializeBlocks(guide.blocks),
      },
    });
  }
);

// ── Customization (published-view theme/layout/hotspot/walkthrough) ───────
guideRouter.patch(
  "/api/guides/:id/customization",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const customization = guideCustomizationSchema.parse(req.body);
    // The logo URL is a display-only presigned value — never persist it (it
    // expires); only the stable logoKey is stored.
    customization.brand.logoUrl = null;

    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    await prisma.guide.update({ where: { id }, data: { customization } });
    res.json({ customization: await serializeCustomization(customization) });
  }
);

// ── Update (bulk block replace) ──────────────────────────────────────────
guideRouter.put(
  "/api/guides/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateGuideSchema.parse(req.body);

    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    // Replace all blocks transactionally — add/edit/delete/reorder in one go.
    await prisma.$transaction(async (tx) => {
      await tx.guide.update({
        where: { id },
        data: { title: input.title, summary: input.summary ?? null },
      });
      await tx.step.deleteMany({ where: { guideId: id } });
      await tx.step.createMany({
        data: input.blocks.map((block, index) => ({
          guideId: id,
          type: block.type,
          position: index + 1,
          content: sanitizeContent(block.content),
          screenshotUrl: block.screenshotKey ?? null, // column stores the key
          elementLabel: block.elementLabel ?? null,
          url: block.url ?? null,
          // Preserve the click pointer across edits (not user-editable).
          clickRect: block.clickRect ?? undefined,
        })),
      });
    });

    const blocks = await prisma.step.findMany({
      where: { guideId: id },
      orderBy: { position: "asc" },
      select: blockSelect,
    });
    res.json({ blocks: await serializeBlocks(blocks) });
  }
);

// ── Publish / unpublish ──────────────────────────────────────────────────
guideRouter.post(
  "/api/guides/:id/publish",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true, shareId: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    const updated = await prisma.guide.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        shareId: guide.shareId ?? nanoid(12), // stable across re-publishes
      },
      select: { shareId: true, status: true, publishedAt: true },
    });
    res.json({ guide: updated });
  }
);

guideRouter.post(
  "/api/guides/:id/unpublish",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    await prisma.guide.update({
      where: { id },
      data: { status: "DRAFT", publishedAt: null },
    });
    res.json({ guide: { status: "DRAFT" } });
  }
);

// ── Pin / unpin ──────────────────────────────────────────────────────────
guideRouter.post(
  "/api/guides/:id/pin",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true, pinnedAt: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    const updated = await prisma.guide.update({
      where: { id },
      data: { pinnedAt: guide.pinnedAt ? null : new Date() },
      select: { pinnedAt: true },
    });
    res.json({ guide: updated });
  }
);

// ── Clone ────────────────────────────────────────────────────────────────
guideRouter.post(
  "/api/guides/:id/clone",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const source = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      include: { blocks: { orderBy: { position: "asc" }, select: blockSelect } },
    });
    if (!source) throw new AppError(404, "NOT_FOUND", "Guide not found");

    // New DRAFT copy; reuses the same screenshot object keys (no R2 copy).
    // The copy stays in the source's folder (default if somehow unset).
    const folderId =
      source.folderId ??
      (await ensureDefaultFolder(prisma, req.workspace!.id));
    const clone = await prisma.guide.create({
      data: {
        title: `Copy of ${source.title}`,
        summary: source.summary,
        status: "DRAFT",
        organizationId: req.workspace!.id,
        createdById: req.user!.id,
        folderId,
        blocks: {
          create: source.blocks.map((block) => ({
            type: block.type,
            position: block.position,
            content: block.content,
            screenshotUrl: block.screenshotUrl, // column holds the R2 key
            elementLabel: block.elementLabel,
            url: block.url,
            clickRect: block.clickRect ?? undefined,
            confidence: block.confidence,
          })),
        },
      },
      select: { id: true },
    });
    res.status(201).json({ guide: clone });
  }
);

// ── Move to another workspace ──────────────────────────────────────────────
guideRouter.post(
  "/api/guides/:id/move",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { organizationId, folderId } = moveGuideSchema.parse(req.body);

    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    // Caller must be a member of the destination workspace.
    const membership = await prisma.member.findFirst({
      where: { organizationId, userId: req.user!.id },
      select: { id: true },
    });
    if (!membership)
      throw new AppError(403, "FORBIDDEN", "Not a member of that workspace");

    // The destination folder must live in the destination workspace.
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, organizationId },
      select: { id: true },
    });
    if (!folder) throw new AppError(404, "NOT_FOUND", "Folder not found");

    await prisma.guide.update({
      where: { id },
      data: { organizationId, folderId, pinnedAt: null },
    });
    res.json({ guide: { id, organizationId, folderId } });
  }
);

// ── Set folder ─────────────────────────────────────────────────────────────
guideRouter.patch(
  "/api/guides/:id/folder",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { folderId } = setGuideFolderSchema.parse(req.body);

    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    // A guide can only join a folder in its own workspace.
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, organizationId: req.workspace!.id },
        select: { id: true },
      });
      if (!folder) throw new AppError(404, "NOT_FOUND", "Folder not found");
    }

    await prisma.guide.update({ where: { id }, data: { folderId } });
    res.json({ guide: { id, folderId } });
  }
);

// ── Delete (soft) ──────────────────────────────────────────────────────────
guideRouter.delete(
  "/api/guides/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    await prisma.guide.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }
);

// ── Analytics ────────────────────────────────────────────────────────────
guideRouter.get(
  "/api/guides/:id/analytics",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: {
        viewCount: true,
        publishedAt: true,
        status: true,
        _count: { select: { blocks: true } },
      },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");
    res.json({
      analytics: {
        viewCount: guide.viewCount,
        status: guide.status,
        publishedAt: guide.publishedAt,
        blockCount: guide._count.blocks,
      },
    });
  }
);
