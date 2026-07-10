import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";

/**
 * Extension connect + identity. The web /extension/connect page (cookie
 * session) calls /token and hands the result to the extension, which then
 * uses it as a Bearer token on every capture call.
 */
export const extensionRouter: Router = Router();

/** The bearer token for the current cookie session (connect handoff). */
extensionRouter.get("/api/extension/token", requireAuth, (req, res) => {
  res.json({ token: req.session!.token });
});

/** Who the extension is acting as + where captures will land. */
extensionRouter.get(
  "/api/extension/me",
  requireAuth,
  requireWorkspace,
  (req, res) => {
    res.json({
      user: { name: req.user!.name, email: req.user!.email },
      workspace: { id: req.workspace!.id, name: req.workspace!.name },
    });
  }
);
