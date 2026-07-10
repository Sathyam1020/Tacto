import { randomUUID } from "node:crypto";

import { prisma } from "@workspace/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, organization } from "better-auth/plugins";

import { env } from "../env.js";
import { generateSlug } from "./slug.js";

/**
 * better-auth instance — the single authority on identity and workspaces.
 *
 * Reached by clients at `${BETTER_AUTH_URL}/api/auth/*` (the web app
 * proxies /api/* to this server, so cookies stay first-party — see
 * next.config.ts rewrites in apps/web).
 *
 * Workspaces are better-auth "organizations" — "Organization" in code,
 * "Workspace" in all UI copy.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_ORIGIN],

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    // Email sending (verification / reset) is wired later with Resend.
    requireEmailVerification: false,
  },

  // Google is enabled only when credentials are configured, so email/password
  // auth works before the OAuth console setup is done.
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},

  // bearer(): lets the Chrome extension authenticate with
  // `Authorization: Bearer <sessionToken>` instead of cookies (which can't
  // cross-origin to an extension). requireAuth's getSession reads it.
  plugins: [organization(), bearer()],

  databaseHooks: {
    user: {
      create: {
        // Every new user gets a personal workspace so the app is never empty.
        after: async (user) => {
          const firstName = user.name.trim().split(/\s+/)[0] || "Personal";
          const workspaceName = `${firstName}'s Workspace`;
          await prisma.organization.create({
            data: {
              id: randomUUID(),
              name: workspaceName,
              slug: generateSlug(workspaceName),
              createdAt: new Date(),
              members: {
                create: {
                  id: randomUUID(),
                  userId: user.id,
                  role: "owner",
                  createdAt: new Date(),
                },
              },
            },
          });
        },
      },
    },
    session: {
      create: {
        // New sessions start with the user's first workspace active,
        // so nobody lands workspace-less after sign-in.
        before: async (session) => {
          const membership = await prisma.member.findFirst({
            where: { userId: session.userId },
            orderBy: { createdAt: "asc" },
            select: { organizationId: true },
          });
          return {
            data: {
              ...session,
              activeOrganizationId: membership?.organizationId ?? null,
            },
          };
        },
      },
    },
  },
});

/** Session shape inferred from the configured auth instance. */
export type AuthSession = typeof auth.$Infer.Session;
