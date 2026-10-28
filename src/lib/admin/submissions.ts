import "server-only";
import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { submissions, submissionStatus, type SubmissionStatus } from "@/db/schema";

// Read-side queries for the enquiry inbox. Submissions are confidential: these
// are only ever called from pages/routes that have checked submissions.view.

export type InboxFilter = { q?: string; status?: string; form?: string; from?: string; to?: string; assigned?: string };

export const INBOX_PAGE_SIZE = 30;

export function inboxWhere(f: InboxFilter, userId?: string): SQL | undefined {
  const conds: SQL[] = [];
  if (f.status && (submissionStatus.enumValues as readonly string[]).includes(f.status)) conds.push(eq(submissions.status, f.status as SubmissionStatus));
  // Spam is hidden unless explicitly requested.
  else conds.push(sql`${submissions.status} <> 'spam'`);
  if (f.form) conds.push(eq(submissions.formId, f.form));
  if (f.assigned === "me" && userId) conds.push(eq(submissions.assignedToId, userId));
  else if (f.assigned === "none") conds.push(sql`${submissions.assignedToId} is null`);
  else if (/^[0-9a-f-]{36}$/.test(f.assigned ?? "")) conds.push(eq(submissions.assignedToId, f.assigned!));
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) conds.push(gte(submissions.createdAt, new Date(`${f.from}T00:00:00+01:00`)));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) conds.push(lte(submissions.createdAt, new Date(`${f.to}T23:59:59+01:00`)));
  const q = f.q?.trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(or(ilike(submissions.name, like), ilike(submissions.email, like), ilike(submissions.phone, like), ilike(submissions.reference, like), sql`${submissions.data}::text ilike ${like}`)!);
  }
  return conds.length ? and(...conds) : undefined;
}

export async function listInbox(f: InboxFilter, page: number, userId?: string) {
  const db = await getDb();
  const where = inboxWhere(f, userId);
  const [{ n }] = await db.select({ n: count() }).from(submissions).where(where);
  const rows = await db
    .select({
      id: submissions.id,
      reference: submissions.reference,
      formId: submissions.formId,
      formTitle: submissions.formTitle,
      status: submissions.status,
      name: submissions.name,
      email: submissions.email,
      phone: submissions.phone,
      createdAt: submissions.createdAt,
      readAt: submissions.readAt,
      assignedToId: submissions.assignedToId,
      files: sql<number>`(select count(*)::int from submission_files sf where sf.submission_id = ${submissions.id})`,
    })
    .from(submissions)
    .where(where)
    .orderBy(desc(submissions.createdAt))
    .limit(INBOX_PAGE_SIZE)
    .offset((page - 1) * INBOX_PAGE_SIZE);
  return { rows, total: n, pages: Math.max(1, Math.ceil(n / INBOX_PAGE_SIZE)) };
}

export async function inboxFormCounts() {
  const db = await getDb();
  return db
    .select({ formId: submissions.formId, formTitle: submissions.formTitle, n: count(), unread: sql<number>`count(*) filter (where ${submissions.status} = 'new')::int` })
    .from(submissions)
    .where(sql`${submissions.status} <> 'spam'`)
    .groupBy(submissions.formId, submissions.formTitle)
    .orderBy(desc(count()));
}
