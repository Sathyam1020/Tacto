import { isDeepStrictEqual } from "node:util";

import {
  createFormSchema,
  emptyFormDocument,
  formDraftPatchSchema,
  parseFormDocument,
  readFormDocument,
  renameFormSchema,
} from "@workspace/contracts/form";
import { ensureDefaultFolder, Prisma, prisma } from "@workspace/db";
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { AppError } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";
import { publishForm } from "./publish.js";
import {
  computeAnalytics,
  computeSummary,
  toCsv,
  type SubmissionRow,
} from "./results.js";
import { buildFormDraft } from "./serialize.js";

/**
 * Forms — workspace-scoped CRUD + the draft/publish lifecycle, mirroring the
 * Guide router (optimistic-concurrency autosave; publish copies the draft
 * document onto the Form and bumps `documentVersion`). Public read/submit lives
 * in the public router. See docs/plans/phase-11-forms-rfc.md.
 */
export const formRouter: Router = Router();

const idParamSchema = z.object({ id: z.string() });
const setFolderSchema = z.object({ folderId: z.string().nullable() });

/** 404 unless the form exists in the caller's workspace. */
async function assertForm(formId: string, workspaceId: string): Promise<void> {
  const form = await prisma.form.findFirst({
    where: { id: formId, organizationId: workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!form) throw new AppError(404, "NOT_FOUND", "Form not found");
}

// ── Create ─────────────────────────────────────────────────────────────────
formRouter.post(
  "/api/forms",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { title, description, folderId } = createFormSchema.parse(req.body);
    const workspaceId = req.workspace!.id;

    // Land in the requested Form folder (validated) or the Form default folder.
    let resolvedFolderId = folderId ?? null;
    if (resolvedFolderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: resolvedFolderId, organizationId: workspaceId, kind: "FORM" },
        select: { id: true },
      });
      if (!folder) throw new AppError(404, "NOT_FOUND", "Folder not found");
    } else {
      resolvedFolderId = await ensureDefaultFolder(prisma, workspaceId, "FORM");
    }

    const seed = emptyFormDocument(title, description ?? null);
    const form = await prisma.form.create({
      data: {
        title,
        description: description ?? null,
        status: "DRAFT",
        organizationId: workspaceId,
        createdById: req.user!.id,
        folderId: resolvedFolderId,
        draft: {
          create: {
            document: seed as unknown as Prisma.InputJsonValue,
            updatedByUserId: req.user!.id,
          },
        },
      },
      select: { id: true },
    });
    res.status(201).json({ form });
  }
);

// ── List ─────────────────────────────────────────────────────────────────
formRouter.get(
  "/api/forms",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const forms = await prisma.form.findMany({
      where: { organizationId: req.workspace!.id, deletedAt: null },
      orderBy: [
        { pinnedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        shareId: true,
        pinnedAt: true,
        folderId: true,
        viewCount: true,
        startCount: true,
        submitCount: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { name: true, image: true } },
      },
    });
    res.json({
      forms: forms.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        status: f.status,
        shareId: f.shareId,
        pinnedAt: f.pinnedAt,
        folderId: f.folderId,
        viewCount: f.viewCount,
        startCount: f.startCount,
        submitCount: f.submitCount,
        author: { name: f.createdBy.name, image: f.createdBy.image },
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    });
  }
);

// ── Detail ───────────────────────────────────────────────────────────────
formRouter.get(
  "/api/forms/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const form = await prisma.form.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        shareId: true,
        publishedAt: true,
        pinnedAt: true,
        folderId: true,
        document: true,
        documentVersion: true,
        viewCount: true,
        startCount: true,
        submitCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!form) throw new AppError(404, "NOT_FOUND", "Form not found");

    const existingDraft = await prisma.formDraft.findUnique({
      where: { formId: id },
      select: { document: true },
    });
    let hasUnpublishedChanges = false;
    if (existingDraft) {
      const parsed = parseFormDocument(existingDraft.document);
      hasUnpublishedChanges = parsed.success
        ? !isDeepStrictEqual(parsed.data, buildFormDraft(form))
        : true;
    }

    const { document, ...rest } = form;
    res.json({
      form: {
        ...rest,
        hasUnpublishedChanges,
        published: readFormDocument(document),
      },
    });
  }
);

// ── Draft: get-or-create ───────────────────────────────────────────────────
formRouter.get(
  "/api/forms/:id/draft",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const form = await prisma.form.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true, title: true, description: true, document: true },
    });
    if (!form) throw new AppError(404, "NOT_FOUND", "Form not found");

    const published = buildFormDraft(form);
    let draft = await prisma.formDraft.findUnique({
      where: { formId: id },
      select: { document: true, version: true },
    });
    if (!draft) {
      try {
        draft = await prisma.formDraft.create({
          data: {
            formId: id,
            document: published as unknown as Prisma.InputJsonValue,
            updatedByUserId: req.user!.id,
          },
          select: { document: true, version: true },
        });
      } catch {
        draft = await prisma.formDraft.findUnique({
          where: { formId: id },
          select: { document: true, version: true },
        });
        if (!draft) throw new AppError(500, "DRAFT_ERROR", "Could not open draft");
      }
    }

    // Recover a malformed draft by reseeding from the published baseline.
    const parsed = parseFormDocument(draft.document);
    let document = published;
    let version = draft.version;
    if (parsed.success) {
      document = parsed.data;
    } else {
      const reseeded = await prisma.formDraft.update({
        where: { formId: id },
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
      document,
      version,
      isDirty: !isDeepStrictEqual(document, published),
    });
  }
);

// ── Draft: autosave (optimistic concurrency) ───────────────────────────────
async function handleFormDraftSave(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const { baseVersion, document } = formDraftPatchSchema.parse(req.body);
  await assertForm(id, req.workspace!.id);

  const result = await prisma.formDraft.updateMany({
    where: { formId: id, version: baseVersion },
    data: {
      document: document as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
      updatedByUserId: req.user!.id,
    },
  });
  if (result.count === 0) {
    const current = await prisma.formDraft.findUnique({
      where: { formId: id },
      select: { version: true },
    });
    if (!current) {
      throw new AppError(404, "NO_DRAFT", "No draft to save — reopen the builder");
    }
    res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "This form was edited elsewhere",
        currentVersion: current.version,
      },
    });
    return;
  }
  const updated = await prisma.formDraft.findUnique({
    where: { formId: id },
    select: { version: true, updatedAt: true },
  });
  res.json({ version: updated!.version, updatedAt: updated!.updatedAt });
}

formRouter.patch(
  "/api/forms/:id/draft",
  requireAuth,
  requireWorkspace,
  handleFormDraftSave
);
formRouter.post(
  "/api/forms/:id/draft",
  requireAuth,
  requireWorkspace,
  handleFormDraftSave
);

// ── Publish (content + visibility; bumps documentVersion) ──────────────────
formRouter.post(
  "/api/forms/:id/publish",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await assertForm(id, req.workspace!.id);
    res.json({ form: await publishForm(id) });
  }
);

// ── Rename / describe ──────────────────────────────────────────────────────
formRouter.patch(
  "/api/forms/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const data = renameFormSchema.parse(req.body);
    await assertForm(id, req.workspace!.id);
    await prisma.form.update({ where: { id }, data });
    res.json({ form: { id, ...data } });
  }
);

// ── Pin / unpin ────────────────────────────────────────────────────────────
formRouter.post(
  "/api/forms/:id/pin",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const form = await prisma.form.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { id: true, pinnedAt: true },
    });
    if (!form) throw new AppError(404, "NOT_FOUND", "Form not found");
    const updated = await prisma.form.update({
      where: { id },
      data: { pinnedAt: form.pinnedAt ? null : new Date() },
      select: { pinnedAt: true },
    });
    res.json({ form: updated });
  }
);

// ── Move to a folder (within the workspace) ────────────────────────────────
formRouter.patch(
  "/api/forms/:id/folder",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { folderId } = setFolderSchema.parse(req.body);
    await assertForm(id, req.workspace!.id);
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, organizationId: req.workspace!.id, kind: "FORM" },
        select: { id: true },
      });
      if (!folder) throw new AppError(404, "NOT_FOUND", "Folder not found");
    }
    await prisma.form.update({ where: { id }, data: { folderId } });
    res.json({ form: { id, folderId } });
  }
);

// ── Clone ────────────────────────────────────────────────────────────────
formRouter.post(
  "/api/forms/:id/clone",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const source = await prisma.form.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: {
        title: true,
        description: true,
        document: true,
        folderId: true,
      },
    });
    if (!source) throw new AppError(404, "NOT_FOUND", "Form not found");

    const folderId =
      source.folderId ??
      (await ensureDefaultFolder(prisma, req.workspace!.id, "FORM"));
    const seed =
      readFormDocument(source.document) ??
      emptyFormDocument(source.title, source.description);
    const title = `Copy of ${source.title}`;
    const clone = await prisma.form.create({
      data: {
        title,
        description: source.description,
        status: "DRAFT",
        organizationId: req.workspace!.id,
        createdById: req.user!.id,
        folderId,
        draft: {
          create: {
            document: { ...seed, title } as unknown as Prisma.InputJsonValue,
            updatedByUserId: req.user!.id,
          },
        },
      },
      select: { id: true },
    });
    res.status(201).json({ form: clone });
  }
);

// ── Delete (soft) ──────────────────────────────────────────────────────────
formRouter.delete(
  "/api/forms/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await assertForm(id, req.workspace!.id);
    await prisma.form.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  }
);

// ── Results: analytics / summary / submissions / export ────────────────────
const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
const analyticsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).optional(),
});

formRouter.get(
  "/api/forms/:id/analytics",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { range } = analyticsQuerySchema.parse(req.query);
    const days = RANGE_DAYS[range ?? "30d"]!;
    const form = await prisma.form.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { viewCount: true, startCount: true, submitCount: true },
    });
    if (!form) throw new AppError(404, "NOT_FOUND", "Form not found");

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.formSubmission.findMany({
      where: { formId: id, createdAt: { gte: since } },
      select: { durationMs: true, createdAt: true, answers: true },
    });
    const submissionRows: SubmissionRow[] = rows.map((r) => ({
      answers: {},
      durationMs: r.durationMs,
      createdAt: r.createdAt,
    }));
    res.json({
      analytics: computeAnalytics(
        { views: form.viewCount, starts: form.startCount, submissions: form.submitCount },
        submissionRows,
        days,
        new Date()
      ),
    });
  }
);

formRouter.get(
  "/api/forms/:id/summary",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const form = await prisma.form.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { document: true },
    });
    if (!form) throw new AppError(404, "NOT_FOUND", "Form not found");
    const document = readFormDocument(form.document);
    if (!document) {
      res.json({ summary: [], total: 0 });
      return;
    }
    const rows = await prisma.formSubmission.findMany({
      where: { formId: id },
      select: { answers: true, durationMs: true, createdAt: true },
    });
    const submissionRows: SubmissionRow[] = rows.map((r) => ({
      answers: (r.answers ?? {}) as Record<string, unknown>,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
    }));
    res.json({
      summary: computeSummary(document.fields, submissionRows),
      total: rows.length,
    });
  }
);

const submissionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

formRouter.get(
  "/api/forms/:id/submissions",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { cursor, limit } = submissionsQuerySchema.parse(req.query);
    await assertForm(id, req.workspace!.id);
    const take = limit ?? 50;
    const rows = await prisma.formSubmission.findMany({
      where: { formId: id },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, answers: true, formVersion: true, createdAt: true },
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    res.json({
      submissions: page,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  }
);

formRouter.get(
  "/api/forms/:id/submissions/export",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const form = await prisma.form.findFirst({
      where: { id, organizationId: req.workspace!.id, deletedAt: null },
      select: { title: true, document: true },
    });
    if (!form) throw new AppError(404, "NOT_FOUND", "Form not found");
    const document = readFormDocument(form.document);
    const rows = await prisma.formSubmission.findMany({
      where: { formId: id },
      orderBy: { createdAt: "desc" },
      select: { answers: true, durationMs: true, createdAt: true },
    });
    const submissionRows: SubmissionRow[] = rows.map((r) => ({
      answers: (r.answers ?? {}) as Record<string, unknown>,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
    }));
    const csv = toCsv(document?.fields ?? [], submissionRows);
    const safe = form.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safe || "form"}-responses.csv"`
    );
    res.send(csv);
  }
);
