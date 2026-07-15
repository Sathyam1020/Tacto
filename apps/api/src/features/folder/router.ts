import {
  createFolderSchema,
  folderKindSchema,
  renameFolderSchema,
} from "@workspace/contracts/folder";
import { ensureDefaultFolder, prisma } from "@workspace/db";
import { Router } from "express";
import { z } from "zod";

import { AppError } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";

const idParamSchema = z.object({ id: z.string() });

/** Folders — flat, workspace-scoped groupings. Guides and Forms keep separate
 *  folder namespaces via `kind` (?kind=GUIDE|FORM, default GUIDE). */
export const folderRouter: Router = Router();

// ── List ─────────────────────────────────────────────────────────────────
folderRouter.get(
  "/api/folders",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    // Optional ?workspaceId lets the move flow list another workspace's
    // folders — as long as the caller is a member of it.
    const requested =
      typeof req.query.workspaceId === "string" ? req.query.workspaceId : null;
    const kind = folderKindSchema.catch("GUIDE").parse(req.query.kind);
    let organizationId = req.workspace!.id;
    if (requested && requested !== organizationId) {
      const member = await prisma.member.findFirst({
        where: { organizationId: requested, userId: req.user!.id },
        select: { id: true },
      });
      if (!member)
        throw new AppError(403, "FORBIDDEN", "Not a member of that workspace");
      organizationId = requested;
    }

    // A workspace always has its default folder for this kind (self-heal legacy).
    await ensureDefaultFolder(prisma, organizationId, kind);

    const folders = await prisma.folder.findMany({
      where: { organizationId, kind },
      orderBy: [{ isDefault: "desc" }, { position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        isDefault: true,
        position: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { guides: true, forms: true } },
      },
    });

    res.json({
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        isDefault: f.isDefault,
        position: f.position,
        itemCount: kind === "FORM" ? f._count.forms : f._count.guides,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    });
  }
);

// ── Create ───────────────────────────────────────────────────────────────
folderRouter.post(
  "/api/folders",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { name, kind } = createFolderSchema.parse(req.body);

    // New folders land at the bottom of their kind's list.
    const last = await prisma.folder.findFirst({
      where: { organizationId: req.workspace!.id, kind },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const folder = await prisma.folder.create({
      data: {
        name,
        kind,
        organizationId: req.workspace!.id,
        position: (last?.position ?? -1) + 1,
      },
      select: { id: true, name: true, position: true },
    });

    res.status(201).json({
      folder: { ...folder, itemCount: 0 },
    });
  }
);

// ── Rename ───────────────────────────────────────────────────────────────
folderRouter.patch(
  "/api/folders/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { name } = renameFolderSchema.parse(req.body);

    const folder = await prisma.folder.findFirst({
      where: { id, organizationId: req.workspace!.id },
      select: { id: true },
    });
    if (!folder) throw new AppError(404, "NOT_FOUND", "Folder not found");

    const updated = await prisma.folder.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, position: true },
    });
    res.json({ folder: updated });
  }
);

// ── Delete (items fall back to that kind's default folder) ─────────────────
folderRouter.delete(
  "/api/folders/:id",
  requireAuth,
  requireWorkspace,
  async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    const folder = await prisma.folder.findFirst({
      where: { id, organizationId: req.workspace!.id },
      select: { id: true, isDefault: true, kind: true },
    });
    if (!folder) throw new AppError(404, "NOT_FOUND", "Folder not found");
    if (folder.isDefault)
      throw new AppError(
        400,
        "CANNOT_DELETE_DEFAULT",
        "The default folder can't be deleted"
      );

    // Items always belong to a folder — move this folder's items to the
    // same-kind default before removing it (never orphan a guide/form).
    await prisma.$transaction(async (tx) => {
      const defaultId = await ensureDefaultFolder(
        tx,
        req.workspace!.id,
        folder.kind
      );
      if (folder.kind === "FORM") {
        await tx.form.updateMany({
          where: { folderId: id },
          data: { folderId: defaultId },
        });
      } else {
        await tx.guide.updateMany({
          where: { folderId: id },
          data: { folderId: defaultId },
        });
      }
      await tx.folder.delete({ where: { id } });
    });
    res.status(204).end();
  }
);
