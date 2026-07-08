import { Router } from "express";

/** Liveness probe — no auth, no DB. */
export const healthRouter: Router = Router();

healthRouter.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
