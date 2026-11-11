import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { prepareTestDatabase } from "./setup";

// Public comments: held for approval, with spam traps and per-article switch.
let db: Awaited<ReturnType<typeof import("@/db").getDb>>;
let s: typeof import("@/db/schema");
let lib: typeof import("@/lib/comments");

const ctx = (ip = randomUUID()) => ({ ip, ipHash: ip.slice(0, 32), userAgent: "vitest", refererPath: "/" });

beforeAll(async () => {
  await prepareTestDatabase();
  db = await (await import("@/db")).getDb();
  s = await import("@/db/schema");
  lib = await import("@/lib/comments");
});

async function makePost(commentsOpen = true) {
  const [p] = await db
    .insert(s.posts)
    .values({ slug: `comment-test-${randomUUID()}`, title: "Comment test", html: "<p>Body</p>", excerpt: "", status: "published", publishedAt: new Date(Date.now() - 60_000), commentsOpen })
    .returning();
  return p;
}

const payload = (postId: string, over: Record<string, unknown> = {}) => ({ postId, name: "Ada Reader", email: `ada-${randomUUID()}@example.com`, comment: "Very helpful article, thank you.", elapsedMs: 10_000, ...over });

describe("public comments", () => {
  it("stores a comment as pending (not shown) with the reader's email", async () => {
    const post = await makePost();
    const res = await lib.submitComment(payload(post.id), ctx());
    expect(res.ok).toBe(true);
    const rows = await db.select().from(s.comments).where(eq(s.comments.postId, post.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", authorName: "Ada Reader" });
    expect(rows[0].authorEmail).toMatch(/@example\.com$/);
    expect(rows[0].html).toBe("<p>Very helpful article, thank you.</p>");
  });

  it("escapes HTML instead of keeping it", async () => {
    const post = await makePost();
    await lib.submitComment(payload(post.id, { comment: "<script>alert(1)</script> hello" }), ctx());
    const [row] = await db.select().from(s.comments).where(eq(s.comments.postId, post.id));
    expect(row.html).not.toContain("<script>");
    expect(row.html).toContain("&lt;script&gt;");
  });

  it("silently drops bot submissions (honeypot or instant)", async () => {
    const post = await makePost();
    expect((await lib.submitComment(payload(post.id, { website: "http://spam.example" }), ctx())).ok).toBe(true);
    expect((await lib.submitComment(payload(post.id, { elapsedMs: 200 }), ctx())).ok).toBe(true);
    expect(await db.select().from(s.comments).where(eq(s.comments.postId, post.id))).toHaveLength(0);
  });

  it("files link-heavy comments as spam", async () => {
    const post = await makePost();
    await lib.submitComment(payload(post.id, { comment: "Buy now https://a.example https://b.example https://c.example" }), ctx());
    const [row] = await db.select().from(s.comments).where(eq(s.comments.postId, post.id));
    expect(row.status).toBe("spam");
  });

  it("refuses comments when the article has them switched off", async () => {
    const post = await makePost(false);
    const res = await lib.submitComment(payload(post.id), ctx());
    expect(res.ok).toBe(false);
  });

  it("validates name, email and length", async () => {
    const post = await makePost();
    const res = await lib.submitComment(payload(post.id, { name: "A", email: "not-an-email", comment: "" }), ctx());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.fields ?? {}).sort()).toEqual(["comment", "email", "name"]);
  });
});
