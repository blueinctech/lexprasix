import "server-only";
import { refresh } from "next/cache";
import type { z } from "zod";
import { AuthError, requireUser, type CurrentUser } from "@/lib/auth/current";
import type { Permission } from "@/lib/auth/permissions";
import { ConfigurationError } from "@/lib/env";
import { logger } from "@/lib/security/logger";
import type { ActionState } from "./types";

// Wraps every mutating admin Server Action: authenticate and authorise the
// caller from the session cookie (server-side, whatever the UI shows), run the
// body, and turn expected failures into an ActionState the form can display.
// Next.js navigation errors (redirect, notFound) are rethrown untouched.

function isNavigationError(err: unknown) {
  const digest = (err as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}

export async function adminAction(permission: Permission, run: (user: CurrentUser) => Promise<ActionState>): Promise<ActionState> {
  try {
    const user = await requireUser(permission);
    const result = await run(user);
    // Re-render the admin page the action came from so it shows the saved data.
    if (result.status === "ok") refresh();
    return result;
  } catch (err) {
    if (isNavigationError(err)) throw err;
    if (err instanceof AuthError || err instanceof ConfigurationError) return { status: "error", message: err.message };
    // Unique-constraint violations are usually a duplicate slug/path/email.
    const msg = String((err as { cause?: { message?: string } })?.cause?.message ?? (err as Error)?.message ?? "");
    if (/duplicate key|unique constraint/i.test(msg)) return { status: "error", message: "That value is already in use (for example the slug or URL). Choose another." };
    logger.error("Admin action failed", { permission, err });
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

/** First message per field from a Zod error, keyed by the dotted path. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError): ActionState {
  const errors = fieldErrors(error);
  return { status: "error", message: Object.values(errors)[0] ?? "Please check the form.", errors };
}

/** FormData → plain object (repeated keys become arrays). */
export function formObject(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$ACTION")) continue;
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}
