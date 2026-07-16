import { randomUUID } from "node:crypto";

import { ensureDefaultFolder, prisma } from "@workspace/db";
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

  user: {
    // Account deletion (Settings ▸ Danger zone). No email verification step
    // (Resend not wired) — the client gates it with a typed confirmation.
    deleteUser: {
      enabled: true,
      // Before the account goes, delete every workspace this user SOLELY owns
      // so none is left ownerless. Organization cascade removes its guides,
      // folders, forms, and help center. Shared workspaces with another owner
      // are left intact.
      beforeDelete: async (user) => {
        const owned = await prisma.member.findMany({
          where: { userId: user.id, role: "owner" },
          select: { organizationId: true },
        });
        for (const { organizationId } of owned) {
          const otherOwners = await prisma.member.count({
            where: { organizationId, role: "owner", userId: { not: user.id } },
          });
          if (otherOwners === 0) {
            await prisma.organization.delete({ where: { id: organizationId } });
          }
        }
      },
    },
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
  plugins: [
    // Workspaces created via the UI get a default folder too (signup creates
    // its workspace directly, handled in the user.create hook below).
    organization({
      // Email delivery (Resend) is not wired yet, so invitations are
      // LINK-BASED in V1: the inviter copies the /invite/{id} link and shares
      // it. This seam records the invite; once Resend lands, send the email
      // here and nothing else changes.
      sendInvitationEmail: async (data) => {
        console.info(
          `[invite] ${data.email} → "${data.organization.name}" (invitation ${data.id})`
        );
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization: org }) => {
          await ensureDefaultFolder(prisma, org.id);
        },
      },
    }),
    bearer(),
  ],

  databaseHooks: {
    user: {
      create: {
        // Every new user gets a personal workspace so the app is never empty.
        after: async (user) => {
          const firstName = user.name.trim().split(/\s+/)[0] || "Personal";
          const workspaceName = `${firstName}'s Workspace`;
          const organizationId = randomUUID();
          await prisma.organization.create({
            data: {
              id: organizationId,
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
          // Every workspace starts with a default folder so guides always have
          // a home.
          await ensureDefaultFolder(prisma, organizationId);
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
