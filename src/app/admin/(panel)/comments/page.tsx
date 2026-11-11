import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { deleteComment, replyToComment, setCommentStatus } from "@/app/admin/_actions/comments";
import { ActionForm, Badge, Card, EmptyState, formatDateTime, PageTitle, SubmitButton, TextArea } from "@/components/admin/ui";
import { getDb } from "@/db";
import { comments, posts } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";
import { sanitizeRichHtml } from "@/lib/sanitize";

export const metadata: Metadata = { title: "Comments" };

const TABS = [
  { status: "pending", label: "Awaiting approval" },
  { status: "approved", label: "Approved" },
  { status: "spam", label: "Spam" },
] as const;
type Status = (typeof TABS)[number]["status"];
const PER_PAGE = 30;

export default async function CommentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("comments.manage");
  const params = await searchParams;
  const status: Status = TABS.some((t) => t.status === params.status) ? (params.status as Status) : "pending";
  const page = Math.max(1, Number(params.page) || 1);
  const db = await getDb();
  const counts = Object.fromEntries((await db.select({ status: comments.status, n: count() }).from(comments).groupBy(comments.status)).map((r) => [r.status, r.n]));
  const parent = sql<string | null>`(select c2.author_name from comments c2 where c2.id = ${comments.parentId})`;
  const rows = await db
    .select({
      id: comments.id,
      authorName: comments.authorName,
      authorEmail: comments.authorEmail,
      html: comments.html,
      isStaffReply: comments.isStaffReply,
      createdAt: comments.createdAt,
      replyTo: parent,
      postTitle: posts.title,
      postSlug: posts.slug,
      postId: posts.id,
    })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(and(eq(comments.status, status)))
    .orderBy(desc(comments.createdAt))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE);
  const total = counts[status] ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <PageTitle title="Comments" description="Readers' comments on blog posts. Nothing appears on the site until it's approved. Turn comments off for an article under Details in its editor." />
      <nav aria-label="Comment status" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/admin/comments/?status=${t.status}`}
            aria-current={t.status === status ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${t.status === status ? "bg-navy-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {t.label} ({counts[t.status] ?? 0})
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Card>
          <EmptyState title={status === "pending" ? "No comments waiting" : "Nothing here"} text={status === "pending" ? "New comments from readers appear here for approval. You also get an email for each one." : undefined} />
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-semibold text-slate-900">
                    {c.authorName} {c.isStaffReply && <Badge value="published" label="Staff reply" />}
                  </p>
                  {c.authorEmail && (
                    <a href={`mailto:${c.authorEmail}`} className="text-navy-700 hover:underline">
                      {c.authorEmail}
                    </a>
                  )}
                  <p className="mt-1 text-slate-500">
                    {formatDateTime(c.createdAt)} · on{" "}
                    <a href={`/${c.postSlug}/#comments`} target="_blank" rel="noopener" className="text-navy-700 hover:underline">
                      {c.postTitle}
                    </a>
                    {c.replyTo && <> · reply to {c.replyTo}</>}
                  </p>
                </div>
                <Badge value={status === "approved" ? "published" : status} label={TABS.find((t) => t.status === status)?.label} />
              </div>
              <div className="prose prose-sm mt-3 max-w-none rounded-lg bg-slate-50 px-4 py-3 text-slate-800" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(c.html) }} />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {status !== "approved" && (
                  <ActionForm action={setCommentStatus}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value="approved" />
                    <SubmitButton small pendingLabel="Approving…">
                      Approve
                    </SubmitButton>
                  </ActionForm>
                )}
                {status === "approved" && (
                  <ActionForm action={setCommentStatus}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value="pending" />
                    <SubmitButton small variant="secondary" pendingLabel="…">
                      Unapprove
                    </SubmitButton>
                  </ActionForm>
                )}
                {status !== "spam" && !c.isStaffReply && (
                  <ActionForm action={setCommentStatus}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value="spam" />
                    <SubmitButton small variant="secondary" pendingLabel="…">
                      Spam
                    </SubmitButton>
                  </ActionForm>
                )}
                <ActionForm action={deleteComment}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton small variant="danger" pendingLabel="Deleting…" confirm="Delete this comment (and any replies to it) permanently?">
                    Delete
                  </SubmitButton>
                </ActionForm>
              </div>
              {status !== "spam" && !c.isStaffReply && (
                <details className="mt-4 rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">Reply on the article{status === "pending" ? " (also approves this comment)" : ""}</summary>
                  <ActionForm action={replyToComment} resetOnSuccess className="mt-3 grid gap-3">
                    <input type="hidden" name="id" value={c.id} />
                    <TextArea label="Your reply" name="reply" rows={4} maxLength={3000} required hint="Shown under the comment with a LexPraxis badge." />
                    <div>
                      <SubmitButton small>Post reply</SubmitButton>
                    </div>
                  </ActionForm>
                </details>
              )}
            </Card>
          ))}
          {pages > 1 && (
            <div className="flex justify-between text-sm">
              {page > 1 ? <Link href={`/admin/comments/?status=${status}&page=${page - 1}`} className="text-navy-700 hover:underline">← Newer</Link> : <span />}
              {page < pages ? <Link href={`/admin/comments/?status=${status}&page=${page + 1}`} className="text-navy-700 hover:underline">Older →</Link> : <span />}
            </div>
          )}
        </div>
      )}
    </>
  );
}
