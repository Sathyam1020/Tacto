import { randomUUID } from "node:crypto";

import cors from "cors";
import express, { type Express } from "express";
import { toNodeHandler } from "better-auth/node";

import { captureRouter } from "./features/capture/router.js";
import { extensionRouter } from "./features/extension/router.js";
import { faqRouter } from "./features/faq/router.js";
import { folderRouter } from "./features/folder/router.js";
import { formPublicRouter } from "./features/form/public-router.js";
import { formRouter } from "./features/form/router.js";
import { guideRouter } from "./features/guide/router.js";
import { healthRouter } from "./features/health/router.js";
import { helpCenterRouter } from "./features/help-center/router.js";
import { helpPublicRouter } from "./features/public/help-router.js";
import { imageRouter } from "./features/img/router.js";
import { mediaRouter } from "./features/media/router.js";
import { meRouter } from "./features/me/router.js";
import { publicRouter } from "./features/public/router.js";
import { showcasePublicRouter } from "./features/public/showcase-router.js";
import { sitemapRouter } from "./features/public/sitemap-router.js";
import { showcaseRouter } from "./features/showcase/router.js";
import { uploadsRouter } from "./features/uploads/router.js";
import { voiceRouter } from "./features/voice/router.js";
import { workspaceRouter } from "./features/workspace/router.js";
import { webOrigins } from "./env.js";
import { auth } from "./lib/auth.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error.js";

/**
 * App assembly. Order is load-bearing:
 *  1. CORS — the Chrome extension calls this API cross-origin with Bearer.
 *  2. better-auth handler — must receive the raw body; express.json()
 *     before it breaks the auth endpoints (per docs).
 *  3. JSON parsing for our own routes.
 *  4. Feature routers.
 *  5. Error middleware LAST.
 */
export function createApp(): Express {
  const app = express();

  // The extension's origin is chrome-extension://<id>; the web app is
  // same-origin (proxied) and doesn't need CORS but is allowed anyway.
  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          origin.startsWith("chrome-extension://") ||
          webOrigins.includes(origin.replace(/\/+$/, ""))
        ) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Structured request log → stdout + PostHog Logs. Each request gets an id
  // (echoed as x-request-id) so one request's log lines are filterable. Health
  // checks are skipped to keep the stream signal-heavy.
  app.use((req, res, next) => {
    if (req.path === "/api/health") return next();
    const requestId = randomUUID();
    const start = Date.now();
    res.setHeader("x-request-id", requestId);
    res.on("finish", () => {
      logger.info(
        {
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - start,
          origin: req.headers.origin,
        },
        `${req.method} ${req.path} ${res.statusCode}`
      );
    });
    next();
  });

  // Express 5 catch-all syntax (`*splat`, not `*`).
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json());

  app.use(healthRouter);
  app.use(publicRouter);
  app.use(formPublicRouter);
  app.use(helpPublicRouter);
  app.use(showcasePublicRouter);
  app.use(sitemapRouter);
  app.use(imageRouter);
  app.use(meRouter);
  app.use(workspaceRouter);
  app.use(captureRouter);
  app.use(guideRouter);
  app.use(voiceRouter);
  app.use(faqRouter);
  app.use(formRouter);
  app.use(helpCenterRouter);
  app.use(showcaseRouter);
  app.use(folderRouter);
  app.use(mediaRouter);
  app.use(uploadsRouter);
  app.use(extensionRouter);

  app.use(errorHandler);

  return app;
}
