import type { Member, Organization } from "@workspace/db";

import type { AuthSession } from "../lib/auth.js";

/**
 * Request augmentation:
 *  - `requireAuth` attaches the verified session (`user`, `session`).
 *  - `requireWorkspace` attaches the active workspace (`workspace`,
 *    `membership`). Handlers behind these middlewares can rely on them.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthSession["user"];
      session?: AuthSession["session"];
      workspace?: Organization;
      membership?: Member;
    }
  }
}

export {};
