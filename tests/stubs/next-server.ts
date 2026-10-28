// `after` runs the callback right away so tests can await its side effects.
export const pending: Promise<unknown>[] = [];
export function after(fn: () => unknown) {
  pending.push(Promise.resolve().then(fn));
}
export async function connection() {}
export { NextResponse, NextRequest } from "next/dist/server/web/exports/index.js";
