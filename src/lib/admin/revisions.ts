import "server-only";
import { and, desc, eq, lt, notInArray } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/db";
import { revisions, users } from "@/db/schema";

// Every save stores the record as it was *before* the change, so editors can
// see and restore earlier versions. The newest 30 per record are kept.

export type RevisionEntity = "page" | "post" | "service" | "document";
const KEEP = 30;

export async function saveRevision(entityType: RevisionEntity, entityId: string, snapshot: Record<string, unknown>, userId: string | null, db?: DbOrTx): Promise<void> {
  const conn = db ?? (await getDb());
  await conn.insert(revisions).values({ entityType, entityId, snapshot: JSON.parse(JSON.stringify(snapshot)), createdById: userId });
  const keep = await conn
    .select({ id: revisions.id })
    .from(revisions)
    .where(and(eq(revisions.entityType, entityType), eq(revisions.entityId, entityId)))
    .orderBy(desc(revisions.createdAt))
    .limit(KEEP);
  if (keep.length === KEEP) {
    const oldest = await conn.select({ createdAt: revisions.createdAt }).from(revisions).where(eq(revisions.id, keep[KEEP - 1].id));
    if (oldest[0]) {
      await conn
        .delete(revisions)
        .where(and(eq(revisions.entityType, entityType), eq(revisions.entityId, entityId), lt(revisions.createdAt, oldest[0].createdAt), notInArray(revisions.id, keep.map((k) => k.id))));
    }
  }
}

export async function listRevisions(entityType: RevisionEntity, entityId: string) {
  const db = await getDb();
  return db
    .select({ id: revisions.id, createdAt: revisions.createdAt, by: users.name, snapshot: revisions.snapshot })
    .from(revisions)
    .leftJoin(users, eq(users.id, revisions.createdById))
    .where(and(eq(revisions.entityType, entityType), eq(revisions.entityId, entityId)))
    .orderBy(desc(revisions.createdAt))
    .limit(KEEP);
}

export async function getRevision(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(revisions).where(eq(revisions.id, id));
  return row ?? null;
}
