import type { NextFunction, Request, Response } from "express";
import { prisma } from "@workspace/db";

import { AppError } from "./error.js";

/**
 * Workspace gate — mount AFTER requireAuth.
 *
 * Verifies the session's active workspace and the user's membership in it,
 * then attaches `req.workspace` + `req.membership`. Every workspace-scoped
 * feature route builds on this; it is the authorization boundary that
 * prevents cross-workspace access.
 */
export async function requireWorkspace(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.session) {
    throw new AppError(401, "UNAUTHORIZED", "Sign in to continue");
  }

  let activeOrganizationId = req.session.activeOrganizationId;

  if (!activeOrganizationId) {
    // Self-heal: the very first session after sign-up can miss its active
    // workspace (the session is created before the user.create.after hook
    // finishes creating the personal workspace). Fall back to the user's
    // first membership and persist it on the session.
    const firstMembership = await prisma.member.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });
    if (!firstMembership) {
      throw new AppError(
        400,
        "NO_ACTIVE_WORKSPACE",
        "Select a workspace to continue"
      );
    }
    activeOrganizationId = firstMembership.organizationId;
    await prisma.session.update({
      where: { id: req.session.id },
      data: { activeOrganizationId },
    });
  }

  const membership = await prisma.member.findFirst({
    where: {
      organizationId: activeOrganizationId,
      userId: req.user.id,
    },
    include: { organization: true },
  });

  if (!membership) {
    // The session points at a workspace this user is not a member of
    // (e.g. removed after sign-in). Treat as forbidden, not missing.
    throw new AppError(
      403,
      "NOT_A_MEMBER",
      "You do not have access to this workspace"
    );
  }

  req.workspace = membership.organization;
  req.membership = membership;
  next();
}
