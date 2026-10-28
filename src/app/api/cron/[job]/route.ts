import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { publishScheduled, purgeExpired, sendDueEmails } from "@/lib/jobs";
import { logger } from "@/lib/security/logger";

// Vercel Cron calls these with "Authorization: Bearer $CRON_SECRET".
//   /api/cron/outbox    every 5 minutes — send/retry emails
//   /api/cron/publish   every 5 minutes — publish scheduled content
//   /api/cron/cleanup   daily — retention purge, expired sessions, rate-limit rows

const JOBS: Record<string, () => Promise<unknown>> = { outbox: sendDueEmails, publish: publishScheduled, cleanup: purgeExpired };

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const run = JOBS[job];
  if (!run) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const result = await run();
    return NextResponse.json({ ok: true, job, result });
  } catch (err) {
    logger.error("Cron job failed", { job, err });
    return NextResponse.json({ ok: false, job }, { status: 500 });
  }
}
