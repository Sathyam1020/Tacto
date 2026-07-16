import { presignGet } from "@workspace/storage";
import { Router } from "express";

/**
 * Public same-origin image proxy for avatars + workspace logos. They live in a
 * PRIVATE R2 bucket but must render as plain `<img src>` everywhere — the rail
 * avatar, the workspace switcher, and the help-center logo shown to anonymous
 * visitors. The stored value is a stable `/api/img/{key}` URL; this route
 * redirects to a short-lived presigned R2 URL (R2 returns the correct
 * Content-Type set at upload), which the browser caches per the redirect.
 *
 * Scoped hard to the `img/` prefix so it can NEVER serve capture screenshots or
 * any other private object. Unauthenticated by design (avatars/logos are meant
 * to be displayed, including on the public help center).
 */
export const imageRouter: Router = Router();

imageRouter.get(/^\/api\/img\//, async (req, res) => {
  const key = decodeURIComponent(req.path.replace(/^\/api\/img\//, ""));
  if (!key.startsWith("img/") || key.includes("..")) {
    res.status(404).end();
    return;
  }
  try {
    const url = await presignGet(key, 3600);
    res.setHeader("Cache-Control", "private, max-age=600");
    res.redirect(302, url);
  } catch {
    res.status(404).end();
  }
});
