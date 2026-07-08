import express, { type Express } from "express";
import { toNodeHandler } from "better-auth/node";

import { captureRouter } from "./features/capture/router.js";
import { guideRouter } from "./features/guide/router.js";
import { healthRouter } from "./features/health/router.js";
import { meRouter } from "./features/me/router.js";
import { workspaceRouter } from "./features/workspace/router.js";
import { auth } from "./lib/auth.js";
import { errorHandler } from "./middleware/error.js";

/**
 * App assembly. Order is load-bearing:
 *  1. better-auth handler FIRST — it must receive the raw body;
 *     express.json() before it breaks the auth endpoints (per docs).
 *  2. JSON parsing for our own routes.
 *  3. Feature routers.
 *  4. Error middleware LAST.
 */
export function createApp(): Express {
  const app = express();

  // Express 5 catch-all syntax (`*splat`, not `*`).
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json());

  app.use(healthRouter);
  app.use(meRouter);
  app.use(workspaceRouter);
  app.use(captureRouter);
  app.use(guideRouter);

  app.use(errorHandler);

  return app;
}
