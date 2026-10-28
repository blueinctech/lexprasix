// Result of an admin Server Action, rendered by <ActionMessage>.
export type ActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
  /** Field name → error message. */
  errors?: Record<string, string>;
  /** Extra values for the form (e.g. a new record id, an invite link to copy). */
  data?: Record<string, string>;
};

export const IDLE: ActionState = { status: "idle" };

export const ok = (message: string, data?: Record<string, string>): ActionState => ({ status: "ok", message, data });
export const fail = (message: string, errors?: Record<string, string>): ActionState => ({ status: "error", message, errors });
