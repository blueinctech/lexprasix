import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { prepareTestDatabase } from "./setup";

// "Writes as → Create a profile with their name" on the invite and edit user forms.
vi.mock("@/lib/admin/action", async (orig) => ({
  ...(await orig<typeof import("@/lib/admin/action")>()),
  adminAction: async (_perm: string, fn: (u: unknown) => unknown) => fn({ id: adminId, name: "Admin", role: "administrator", authorId: null }),
}));
vi.mock("@/lib/auth/service", () => ({ sendInvite: async () => ({ link: "https://example.test/invite" }), createResetLink: async () => "" }));
vi.mock("@/lib/audit", () => ({ audit: async () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));

let adminId = "";
let db: Awaited<ReturnType<typeof import("@/db").getDb>>;
let s: typeof import("@/db/schema");
let actions: typeof import("@/app/admin/_actions/users");

beforeAll(async () => {
  await prepareTestDatabase();
  db = await (await import("@/db")).getDb();
  s = await import("@/db/schema");
  actions = await import("@/app/admin/_actions/users");
  const [a] = await db.insert(s.users).values({ email: `admin-${randomUUID()}@example.com`, name: "Admin", role: "administrator", isActive: true }).returning();
  adminId = a.id;
});

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};

describe("author profiles for staff", () => {
  it("inviting with 'new' creates a profile with their name and links it", async () => {
    const name = `Treasure Ubana ${randomUUID().slice(0, 6)}`;
    const email = `t-${randomUUID()}@example.com`;
    const res = await actions.inviteUser({ status: "idle" } as never, form({ name, email, role: "author", authorId: "new" }));
    expect(res.status).toBe("ok");
    const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
    expect(u.authorId).toBeTruthy();
    const [a] = await db.select().from(s.authors).where(eq(s.authors.id, u.authorId!));
    expect(a.name).toBe(name);
  });

  it("editing an unlinked user with 'new' links a fresh profile; a clashing name gets a unique URL", async () => {
    const name = `Same Name ${randomUUID().slice(0, 6)}`;
    await db.insert(s.authors).values({ name, slug: name.toLowerCase().replace(/ /g, "-") });
    const [u] = await db.insert(s.users).values({ email: `u-${randomUUID()}@example.com`, name, role: "author", isActive: true }).returning();
    const res = await actions.updateUser({ status: "idle" } as never, form({ id: u.id, name, role: "author", authorId: "new" }));
    expect(res.status).toBe("ok");
    const [after] = await db.select().from(s.users).where(eq(s.users.id, u.id));
    const [a] = await db.select().from(s.authors).where(eq(s.authors.id, after.authorId!));
    expect(a.name).toBe(name);
    expect(a.slug).toMatch(/-2$/);
  });

  it("'None' leaves the user unlinked", async () => {
    const email = `n-${randomUUID()}@example.com`;
    await actions.inviteUser({ status: "idle" } as never, form({ name: "No Writer", email, role: "editor", authorId: "" }));
    const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
    expect(u.authorId).toBeNull();
  });
});
