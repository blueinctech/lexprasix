import "server-only";

/**
 * Minimal structured logger that redacts sensitive keys recursively. Put
 * context in `meta` (never in the message) so it is filtered. Submission
 * values are personal data: never pass them here.
 */

const SENSITIVE_KEY = /pass|secret|token|cookie|authorization|session|api[_-]?key|email|phone|url|values|data/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) {
    // Drizzle wraps driver errors; the cause holds the Postgres message (no parameters).
    const cause = value.cause instanceof Error ? { name: value.cause.name, message: value.cause.message } : undefined;
    return { name: value.name, message: value.message.split("\nparams:")[0], ...(cause ? { cause } : {}) };
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

type Level = "info" | "warn" | "error";

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  const entry = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...(meta ? { meta: redact(meta) } : {}),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
