import { z } from "zod";

/**
 * Settings contracts. Settings manages Account · Workspace · Preferences ·
 * Connected only — identity/org mutations go through better-auth, so these
 * schemas cover just the payloads our own endpoints and forms validate.
 */

// ── Profile ─────────────────────────────────────────────────────────────────
export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Keep it under 50 characters"),
});
export type ProfileInput = z.infer<typeof profileSchema>;

// ── Image upload (avatar + workspace logo) ──────────────────────────────────
export const IMAGE_UPLOAD_KINDS = ["avatar", "logo"] as const;
export type ImageUploadKind = (typeof IMAGE_UPLOAD_KINDS)[number];

/** Formats we accept for avatars/logos. */
export const IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** 2 MB — avatars/logos are small; keeps the private-bucket proxy cheap. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const imageUploadSchema = z.object({
  kind: z.enum(IMAGE_UPLOAD_KINDS),
  contentType: z.enum(IMAGE_CONTENT_TYPES),
});
export type ImageUploadInput = z.infer<typeof imageUploadSchema>;

// ── Password (Phase 2) ──────────────────────────────────────────────────────
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Use at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

// ── Invitations (Phase 4) ───────────────────────────────────────────────────
export const workspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

/** Roles that can be assigned via the invite form (owner is transfer-only). */
export const inviteRoleSchema = z.enum(["admin", "member"]);

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  role: inviteRoleSchema,
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
