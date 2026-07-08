import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";

/**
 * Workspace endpoints. CRUD/switching happens through better-auth's
 * organization endpoints (/api/auth/organization/*) — this feature only
 * exposes what those don't, and demonstrates the requireWorkspace pattern
 * every future workspace-scoped feature follows.
 */
export const workspaceRouter: Router = Router();

workspaceRouter.get(
  "/api/workspace/current",
  requireAuth,
  requireWorkspace,
  (req, res) => {
    // requireWorkspace guarantees these — the non-null assertions are safe.
    const workspace = req.workspace!;
    const membership = req.membership!;
    res.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        logo: workspace.logo,
        createdAt: workspace.createdAt,
      },
      role: membership.role,
    });
  }
);
