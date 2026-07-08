import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/**
 * Auth client. No baseURL — auth lives on this origin at /api/auth
 * (Next.js rewrites proxy it to the API), so cookies are first-party.
 *
 * Organizations are Tacto workspaces ("Workspace" in all UI copy).
 *
 * Use methods directly (authClient.signIn.email, authClient.useSession, …);
 * destructured re-exports break TS declaration portability (TS2742).
 */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
})
