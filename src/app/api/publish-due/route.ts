import { NextResponse } from "next/server";
import { publishScheduled } from "@/lib/jobs";
import { logger } from "@/lib/security/logger";

// Publishes scheduled content whose time has come. Called in the background by
// the proxy (at most once a minute per server instance) so scheduled articles go
// live even if Vercel Cron doesn't run. It only ever does what is already due,
// so it needs no secret; a short throttle keeps repeated calls cheap.

const MIN_GAP_MS = 20_000;
let lastRun = 0;

export async function POST() {
  if (Date.now() - lastRun < MIN_GAP_MS) return NextResponse.json({ ok: true, skipped: true }, { headers: { "Cache-Control": "no-store" } });
  lastRun = Date.now();
  try {
    const published = await publishScheduled();
    return NextResponse.json({ ok: true, published }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error("Publishing scheduled content failed", { err });
    return NextResponse.json({ ok: false }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
