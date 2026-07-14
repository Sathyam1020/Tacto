import { isDeepStrictEqual } from "node:util";

import { importStepsFromText } from "@workspace/ai";
import {
  addTranslationSchema,
  draftPatchSchema,
  parseDraftDocument,
  moveGuideSchema,
  readFaqs,
  retranslateTargetSchema,
  setGuideFolderSchema,
} from "@workspace/contracts/guide";
import { ensureDefaultFolder, Prisma, prisma } from "@workspace/db";
import {
  deleteTranslation,
  getTranslations,
  markTranslationGenerating,
  retranslateTarget,
  TranslationNotFound,
} from "@workspace/generation";
import { presignGet } from "@workspace/storage";
import express, { Router, type Request, type Response } from "express";
import mammoth from "mammoth";
import { nanoid } from "nanoid";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { z } from "zod";

import { translationQueue } from "../../lib/queue.js";
import { AppError } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";
import { publishDraft } from "./publish-draft.js";
import {
  blockSelect,
  buildDraftDocument,
  draftDocumentForClient,
  draftSourceSelect,
  serializeBlocks,
  serializeCustomization,
  serializeInteractive,
} from "./serialize.js";

const idParamSchema = z.object({ id: z.string() });

/** Guides — workspace-scoped read + edit + publish. */
export const guideRouter: Router = Router();

/** 404 unless the guide exists in the caller's workspace. */
async function assertGuideInWorkspace(
  guideId: string,
  workspaceId: string
): Promise<void> {
  const guide = await prisma.guide.findFirst({
    where: { id: guideId, organizationId: workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");
}

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

    // Whether an unpublished draft with changes exists (for the viewer's
    // "edits in progress" indicator). A fresh draft equals published → not
    // flagged.
    const existingDraft = await prisma.guideDraft.findUnique({
      where: { guideId: id },
      select: { document: true },
    });
    let hasUnpublishedChanges = false;
    if (existingDraft) {
      const parsed = parseDraftDocument(existingDraft.document);
      if (parsed.success) {
        hasUnpublishedChanges = !isDeepStrictEqual(
          parsed.data,
          buildDraftDocument(guide)
        );
      } else {
        // A malformed/stale draft must never break the guide page.
        console.error(
          `[guide ${id}] draft parse failed:`,
          parsed.error.message
        );
        hasUnpublishedChanges = true;
      }
    }

    res.json({
      guide: {
        id: guide.id,
        title: guide.title,
        summary: guide.summary,
        status: guide.status,
        shareId: guide.shareId,
        publishedAt: guide.publishedAt,
        viewCount: guide.viewCount,
        hasUnpublishedChanges,
        captureSource: guide.capture?.source ?? null,
        createdAt: guide.createdAt,
        customization: await serializeCustomization(guide.customization),
        blocks: await serializeBlocks(guide.blocks),
        interactive: serializeInteractive(guide.interactive),
        faqs: readFaqs(guide.faqs),
      },
    });
  }
);

// ── Draft (private working document) ──────────────────────────────────────
// The editor reads/writes only the draft; published Guide/Step rows are
// unchanged until Publish. GET is get-or-create (seed from published).
guideRouter.get(
  "/api/guides/:id/draft",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true, ...draftSourceSelect },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    const published = buildDraftDocument(guide);
    let draft = await prisma.guideDraft.findUnique({
      where: { guideId: id },
      select: { document: true, version: true },
    });
    if (!draft) {
      try {
        draft = await prisma.guideDraft.create({
          data: {
            guideId: id,
            document: published as unknown as Prisma.InputJsonValue,
            updatedByUserId: req.user!.id,
          },
          select: { document: true, version: true },
        });
      } catch {
        // Lost a create race — re-read the winner.
        draft = await prisma.guideDraft.findUnique({
          where: { guideId: id },
          select: { document: true, version: true },
        });
        if (!draft) throw new AppError(500, "DRAFT_ERROR", "Could not open draft");
      }
    }

    // Recover a malformed/stale draft by reseeding it from the published guide,
    // rather than 500-ing the editor.
    const parsed = parseDraftDocument(draft.document);
    let document = published;
    let version = draft.version;
    if (parsed.success) {
      document = parsed.data;
    } else {
      console.error(
        `[guide ${id}] draft parse failed, reseeding:`,
        parsed.error.message
      );
      const reseeded = await prisma.guideDraft.update({
        where: { guideId: id },
        data: {
          document: published as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedByUserId: req.user!.id,
        },
        select: { version: true },
      });
      version = reseeded.version;
    }
    res.json({
      document: await draftDocumentForClient(document),
      version,
      isDirty: !isDeepStrictEqual(document, published),
    });
  }
);

// Autosave the draft (optimistic concurrency). Shared by PATCH and POST — the
// POST variant exists so the editor can flush on tab-close via sendBeacon,
// which can only issue POSTs.
async function handleDraftSave(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const { baseVersion, document } = draftPatchSchema.parse(req.body);
  const guide = await prisma.guide.findFirst({
    where: { id, organizationId: req.workspace!.id, deletedAt: null },
    select: { id: true },
  });
  if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

  const result = await prisma.guideDraft.updateMany({
    where: { guideId: id, version: baseVersion },
    data: {
      document: document as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
      updatedByUserId: req.user!.id,
    },
  });
  if (result.count === 0) {
    const current = await prisma.guideDraft.findUnique({
      where: { guideId: id },
      select: { version: true },
    });
    if (!current) {
      throw new AppError(404, "NO_DRAFT", "No draft to save — reopen the editor");
    }
    // Return the current version so the client can offer overwrite/reload.
    res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "This guide was edited elsewhere",
        currentVersion: current.version,
      },
    });
    return;
  }
  const updated = await prisma.guideDraft.findUnique({
    where: { guideId: id },
    select: { version: true, updatedAt: true },
  });
  res.json({ version: updated!.version, updatedAt: updated!.updatedAt });
}

guideRouter.patch(
  "/api/guides/:id/draft",
  requireAuth,
  requireWorkspace,
  handleDraftSave
);
guideRouter.post(
  "/api/guides/:id/draft",
  requireAuth,
  requireWorkspace,
  handleDraftSave
);

guideRouter.delete(
  "/api/guides/:id/draft",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");
    await prisma.guideDraft.deleteMany({ where: { guideId: id } });
    res.json({ ok: true });
  }
);

// Publish: apply the draft to the guide's published content (blocks reconciled
// by key), publish translations, and delete the draft — transactionally.
// Visibility (status/shareId) is unchanged; that's the separate Share action.
guideRouter.post(
  "/api/guides/:id/publish-draft",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");
    await publishDraft(id);
    res.json({ ok: true });
  }
);

// ── Import from a document (DOCX/PDF → AI steps) ──────────────────────────
// The browser POSTs the raw file bytes; we extract text and let the AI
// structure it into blocks. Nothing is persisted here — the editor stages the
// returned blocks and saves them with the rest of the guide.
const importKindSchema = z.object({ kind: z.enum(["docx", "pdf"]) });

async function extractText(kind: "docx" | "pdf", buffer: Buffer): Promise<string> {
  if (kind === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  const { text } = await pdfParse(buffer);
  return text;
}

/** Escape plain AI text for safe use inside a `<p>` (it contains no markup). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

guideRouter.post(
  "/api/guides/:id/import-document",
  requireAuth,
  requireWorkspace,
  express.raw({ type: () => true, limit: "25mb" }),
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { kind } = importKindSchema.parse(req.query);

    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    const buffer = req.body as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new AppError(400, "BAD_REQUEST", "No file was received");
    }

    let text: string;
    try {
      text = await extractText(kind, buffer);
    } catch {
      throw new AppError(422, "UNREADABLE", "Couldn't read that document");
    }
    if (!text.trim()) {
      throw new AppError(422, "EMPTY", "No text could be read from that file");
    }

    const { blocks } = await importStepsFromText(text);
    // Wrap each step's plain text as the HTML the editor stores.
    res.json({
      blocks: blocks.map((b) => ({
        type: b.type,
        content: `<p>${escapeHtml(b.text)}</p>`,
      })),
    });
  }
);

// ── Translations (AI language versions) ──────────────────────────────────
// Whole-guide translation runs ASYNC on the worker (the editor never blocks for
// minutes); per-field re-translation is synchronous (fast). Draft-aware. The
// generation logic lives in @workspace/generation (shared with the worker).

guideRouter.get(
  "/api/guides/:id/translations",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await assertGuideInWorkspace(id, req.workspace!.id);
    res.json({ translations: await getTranslations(id) });
  }
);

guideRouter.post(
  "/api/guides/:id/translations",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { language } = addTranslationSchema.parse(req.body);
    await assertGuideInWorkspace(id, req.workspace!.id);
    await markTranslationGenerating(id, language);
    await translationQueue.add("translation", {
      kind: "translation.generate",
      guideId: id,
      language,
    });
    res.json({ translations: await getTranslations(id) });
  }
);

guideRouter.post(
  "/api/guides/:id/translations/:language/retranslate",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const language = z.string().parse(req.params.language);
    const { target } = retranslateTargetSchema.parse(req.body);
    await assertGuideInWorkspace(id, req.workspace!.id);
    try {
      await retranslateTarget(id, language, target);
    } catch (err) {
      if (err instanceof TranslationNotFound) {
        throw new AppError(404, "NO_TRANSLATION", err.message);
      }
      throw err;
    }
    res.json({ translations: await getTranslations(id) });
  }
);

guideRouter.delete(
  "/api/guides/:id/translations/:language",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const language = z.string().parse(req.params.language);
    await assertGuideInWorkspace(id, req.workspace!.id);
    await deleteTranslation(id, language);
    res.json({ ok: true });
  }
);



// ── Publish / unpublish (visibility) ──────────────────────────────────────
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
