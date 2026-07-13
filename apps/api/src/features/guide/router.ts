import { isDeepStrictEqual } from "node:util";

import {
  importStepsFromText,
  translateGuide,
  translateStrings,
} from "@workspace/ai";
import {
  addTranslationSchema,
  collectPresentationStrings,
  computeTranslationStaleness,
  draftPatchSchema,
  parseDraftDocument,
  moveGuideSchema,
  readInteractivePresentation,
  readTranslationSource,
  readTranslationSteps,
  retranslateTargetSchema,
  setGuideFolderSchema,
  TRANSLATION_LANGUAGES,
  type TranslationSource,
} from "@workspace/contracts/guide";
import { ensureDefaultFolder, Prisma, prisma } from "@workspace/db";
import { presignGet } from "@workspace/storage";
import express, { Router, type Request, type Response } from "express";
import mammoth from "mammoth";
import { nanoid } from "nanoid";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { z } from "zod";

import { sanitizeContent } from "../../lib/sanitize.js";
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
// Generated from the SAVED guide and stored per language; the public reader
// offers a language switcher. Translations are KEY-BASED — block content keyed
// by the block's stable key, slide text keyed by slide-string id — so editing,
// reordering, or deleting a step never misaligns a translation. Regenerate the
// whole guide, or re-translate a single drifted step.

/** Select shape for the guide's translatable content, including the private
 *  draft so translations can reflect UNSAVED edits (the editing surface). */
const translatableSelect = {
  id: true,
  title: true,
  summary: true,
  interactive: true,
  blocks: {
    orderBy: { position: "asc" as const },
    select: { key: true, content: true },
  },
  draft: { select: { document: true } },
} as const;

type TranslatableGuide = {
  title: string;
  summary: string | null;
  interactive: unknown;
  blocks: { key: string; content: string }[];
  draft: { document: unknown } | null;
};

/** A guide's translatable strings, keyed the way translations store them: block
 *  content by stable key, slide text by slide-string id. Prefers the DRAFT (what
 *  the editor currently shows) over the published Step rows so a re-translate
 *  picks up unsaved edits; keys are stable across publish, so a draft-based
 *  translation stays aligned once the guide is Saved. */
function guideTranslatable(guide: TranslatableGuide) {
  let title = guide.title;
  let summary = guide.summary;
  let blocks = guide.blocks.map((b) => ({ key: b.key, content: b.content }));
  let interactiveRaw: unknown = guide.interactive;
  if (guide.draft) {
    const parsed = parseDraftDocument(guide.draft.document);
    if (parsed.success) {
      title = parsed.data.title;
      summary = parsed.data.summary;
      blocks = parsed.data.blocks.map((b) => ({ key: b.key, content: b.content }));
      interactiveRaw = parsed.data.interactive;
    }
  }
  const steps: Record<string, string> = {};
  for (const b of blocks) steps[b.key] = b.content;
  const presentation = readInteractivePresentation(interactiveRaw);
  const slides: Record<string, string> = {};
  for (const s of collectPresentationStrings(presentation)) slides[s.id] = s.content;
  return { title, summary, steps, slides, presentation, blocks };
}

guideRouter.get(
  "/api/guides/:id/translations",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: translatableSelect,
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");
    const current = guideTranslatable(guide);
    const orderedKeys = current.blocks.map((b) => b.key);

    const rows = await prisma.guideTranslation.findMany({
      where: { guideId: id },
      orderBy: { language: "asc" },
      select: {
        language: true,
        title: true,
        summary: true,
        steps: true,
        source: true,
        published: true,
      },
    });
    // Return key-based steps + per-translation staleness so the editor can flag
    // which steps drifted and offer a granular re-translate.
    const translations = rows.map((t) => ({
      language: t.language,
      title: t.title,
      summary: t.summary,
      steps: readTranslationSteps(t.steps, orderedKeys),
      published: t.published,
      staleness: computeTranslationStaleness(
        readTranslationSource(t.source),
        current
      ),
    }));
    res.json({ translations });
  }
);

guideRouter.post(
  "/api/guides/:id/translations",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { language } = addTranslationSchema.parse(req.body);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: translatableSelect,
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    const languageName =
      TRANSLATION_LANGUAGES.find((l) => l.code === language)?.name ?? language;
    // Source is the DRAFT (unsaved edits included) — see `guideTranslatable`.
    const current = guideTranslatable(guide);

    // Translate every block (keyed by stable key) + every slide string in one
    // call. Step content lives ONCE (on the blocks) — no per-view duplication,
    // so no dedup pass is needed.
    const ai = await translateGuide(
      {
        title: current.title,
        summary: current.summary,
        blocks: current.blocks.map((b) => ({ id: b.key, content: b.content })),
        interactive: collectPresentationStrings(current.presentation),
      },
      languageName
    );

    // Store by stable key; re-sanitize the model's HTML as defense in depth.
    const steps: Record<string, string> = {};
    for (const b of ai.blocks) {
      if (b.id in current.steps) steps[b.id] = sanitizeContent(b.content);
    }
    // Slide strings are plain text (rendered as text) — sanitize only if the
    // model returned any markup.
    const interactive: Record<string, string> = {};
    for (const s of ai.interactive) {
      interactive[s.id] = /[<>]/.test(s.content)
        ? sanitizeContent(s.content)
        : s.content;
    }
    // Capture the source strings so drift is detectable per step later.
    const source: TranslationSource = {
      title: current.title,
      summary: current.summary,
      steps: current.steps,
      slides: current.slides,
    };

    // A (re)generated translation is a DRAFT — it stays hidden from the public
    // reader until the editor Saves the guide (which publishes translations).
    const saved = await prisma.guideTranslation.upsert({
      where: { guideId_language: { guideId: id, language } },
      create: {
        guideId: id,
        language,
        title: ai.title,
        summary: ai.summary,
        steps,
        interactive,
        source,
        published: false,
      },
      update: {
        title: ai.title,
        summary: ai.summary,
        steps,
        interactive,
        source,
        published: false,
      },
      select: { language: true, title: true, updatedAt: true },
    });
    res.json({ translation: saved });
  }
);

// Re-translate ONE part of an existing translation — the title, the summary, or
// a single step — from the current (draft-aware) guide text. Only that part +
// its captured source are refreshed, so it stops being stale; the rest of the
// translation is untouched.
guideRouter.post(
  "/api/guides/:id/translations/:language/retranslate",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const language = z.string().parse(req.params.language);
    const { target } = retranslateTargetSchema.parse(req.body);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: translatableSelect,
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");

    const existing = await prisma.guideTranslation.findUnique({
      where: { guideId_language: { guideId: id, language } },
      select: { steps: true, source: true },
    });
    if (!existing) {
      throw new AppError(404, "NO_TRANSLATION", "Translate the guide first");
    }

    const languageName =
      TRANSLATION_LANGUAGES.find((l) => l.code === language)?.name ?? language;
    const current = guideTranslatable(guide);

    // Seed a source for legacy rows (null) from the CURRENT strings — legacy
    // translations were treated as fresh, so we don't retroactively cry stale;
    // the retranslated part's source is then set to what we just translated.
    const source: TranslationSource = readTranslationSource(existing.source) ?? {
      title: current.title,
      summary: current.summary,
      steps: { ...current.steps },
      slides: { ...current.slides },
    };

    const data: {
      title?: string;
      summary?: string | null;
      steps?: Record<string, string>;
      source: TranslationSource;
      published: false;
    } = { source, published: false };

    if (target.kind === "title") {
      const [out] = await translateStrings(
        [{ id: "title", content: current.title }],
        languageName
      );
      data.title = out ? out.content : current.title;
      source.title = current.title;
    } else if (target.kind === "summary") {
      if (current.summary == null) {
        data.summary = null;
      } else {
        const [out] = await translateStrings(
          [{ id: "summary", content: current.summary }],
          languageName
        );
        data.summary = out ? out.content : current.summary;
      }
      source.summary = current.summary;
    } else {
      const block = current.blocks.find((b) => b.key === target.stepKey);
      if (!block) throw new AppError(404, "NOT_FOUND", "Step not found");
      const [out] = await translateStrings(
        [{ id: target.stepKey, content: block.content }],
        languageName
      );
      const translated = out ? sanitizeContent(out.content) : block.content;
      const steps = readTranslationSteps(
        existing.steps,
        current.blocks.map((b) => b.key)
      );
      steps[target.stepKey] = translated;
      data.steps = steps;
      source.steps[target.stepKey] = block.content;
    }

    const saved = await prisma.guideTranslation.update({
      where: { guideId_language: { guideId: id, language } },
      data,
      select: { language: true, updatedAt: true },
    });
    res.json({ translation: saved });
  }
);

guideRouter.delete(
  "/api/guides/:id/translations/:language",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const language = z.string().parse(req.params.language);
    const guide = await prisma.guide.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!guide) throw new AppError(404, "NOT_FOUND", "Guide not found");
    await prisma.guideTranslation.deleteMany({
      where: { guideId: id, language },
    });
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
