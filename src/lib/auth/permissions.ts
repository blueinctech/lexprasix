import type { UserRole } from "@/db/schema";

// What each role may do. Checked on the server in every admin action and page
// (requireUser(permission)); the UI only uses it to hide controls.
//
// Administrator: everything. Editor: all content, media, menus, enquiries,
// redirects. Author: their own posts (drafts; publishing needs an editor) and media.

export const PERMISSIONS = {
  "dashboard.view": ["administrator", "editor", "author"],
  "posts.edit_own": ["administrator", "editor", "author"],
  "posts.edit_any": ["administrator", "editor"],
  "posts.publish": ["administrator", "editor"],
  "posts.delete": ["administrator", "editor"],
  "pages.manage": ["administrator", "editor"],
  "services.manage": ["administrator", "editor"],
  "documents.manage": ["administrator", "editor"],
  "taxonomies.manage": ["administrator", "editor"],
  "authors.manage": ["administrator", "editor"],
  "comments.manage": ["administrator", "editor"],
  "media.upload": ["administrator", "editor", "author"],
  "media.manage": ["administrator", "editor"],
  "menus.manage": ["administrator", "editor"],
  "redirects.manage": ["administrator", "editor"],
  "submissions.view": ["administrator", "editor"],
  "submissions.manage": ["administrator", "editor"],
  "submissions.export": ["administrator"],
  "submissions.delete": ["administrator"],
  "email.view": ["administrator"],
  "settings.manage": ["administrator"],
  "users.manage": ["administrator"],
  "audit.view": ["administrator"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: "Administrator",
  editor: "Editor",
  author: "Author",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  administrator: "Full access, including users, site settings, exports and the activity log.",
  editor: "Manages all website content, media, menus, redirects and client enquiries.",
  author: "Writes and edits their own blog drafts and uploads images. An editor publishes.",
};
