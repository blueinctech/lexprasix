import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { prepareTestDatabase } from "./setup";

// Scheduled articles go live through /api/publish-due, which the site calls
// itself, so publishing doesn't depend on Vercel Cron.
let db: Awaited<ReturnType<typeof import("@/db").getDb>>;
let s: typeof import("@/db/schema");

beforeAll(async () => {
  await prepareTestDatabase();
  db = await (await import("@/db")).getDb();
  s = await import("@/db/schema");
});

describe("publish-due", () => {
  it("publishes scheduled articles whose time has passed, and leaves future ones scheduled", async () => {
    const [due] = await db.insert(s.posts).values({ slug: `due-${randomUUID()}`, title: "Due", html: "<p>x</p>", excerpt: "", status: "scheduled", publishedAt: new Date(Date.now() - 60_000) }).returning();
    const [later] = await db.insert(s.posts).values({ slug: `later-${randomUUID()}`, title: "Later", html: "<p>x</p>", excerpt: "", status: "scheduled", publishedAt: new Date(Date.now() + 3_600_000) }).returning();
    const { POST } = await import("@/app/api/publish-due/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const [a] = await db.select().from(s.posts).where(eq(s.posts.id, due.id));
    const [b] = await db.select().from(s.posts).where(eq(s.posts.id, later.id));
    expect(a.status).toBe("published");
    expect(b.status).toBe("scheduled");
  });
});
