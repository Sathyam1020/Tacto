import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";

/**
 * Current-user endpoint — the exemplar for protected feature routes:
 * mount `requireAuth`, then rely on `req.user`.
 */
export const meRouter: Router = Router();

meRouter.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
