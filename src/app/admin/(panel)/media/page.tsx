import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, like, or, type SQL } from "drizzle-orm";
import { MediaUploader } from "@/components/admin/MediaLibrary";
import { Card, EmptyState, PageTitle, Pager, cx } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { ACCEPT_ATTR, adminMediaUrl } from "@/lib/admin/media";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Media library" };

const PER_PAGE = 40;
const TYPES = [
  { value: "", label: "All files" },
  { value: "image", label: "Images" },
  { value: "document", label: "Documents" },
  { value: "video", label: "Video" },
];

type Search = { q?: string; type?: string; alt?: string; page?: string; deleted?: string };

export default async function MediaPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUserPage("media.upload");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const type = TYPES.some((t) => t.value === sp.type) ? (sp.type ?? "") : "";
  const missingAlt = sp.alt === "missing";
  const page = Math.max(1, Number(sp.page) || 1);

  const conds: SQL[] = [];
  if (q) conds.push(or(ilike(media.filename, `%${q}%`), ilike(media.alt, `%${q}%`), ilike(media.caption, `%${q}%`))!);
  if (type === "image") conds.push(like(media.mimeType, "image/%"));
  if (type === "video") conds.push(like(media.mimeType, "video/%"));
  if (type === "document") conds.push(or(like(media.mimeType, "application/%"), like(media.mimeType, "text/%"))!);
  if (missingAlt) conds.push(and(like(media.mimeType, "image/%"), eq(media.alt, ""))!);
  const where = conds.length ? and(...conds) : undefined;

  const db = await getDb();
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: count() }).from(media).where(where),
    db.select().from(media).where(where).orderBy(desc(media.createdAt), desc(media.key)).limit(PER_PAGE).offset((page - 1) * PER_PAGE),
  ]);
  const pages = Math.max(1, Math.ceil(n / PER_PAGE));
  const href = (p: number) => {
    const params = new URLSearchParams({ ...(q ? { q } : {}), ...(type ? { type } : {}), ...(missingAlt ? { alt: "missing" } : {}), ...(p > 1 ? { page: String(p) } : {}) });
    const s = params.toString();
    return `/admin/media/${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageTitle title="Media library" description={`${n} file${n === 1 ? "" : "s"}${q || type || missingAlt ? " match your filters" : ""}. Images and documents used across the website.`} />
      {sp.deleted && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">File deleted.</p>}
      <div className="mb-6">
        <MediaUploader accept={ACCEPT_ATTR} />
      </div>
      <Card padded={false}>
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-4" role="search">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Search
            <input name="q" defaultValue={q} placeholder="File name, alt text or caption" className="h-9 w-64 rounded-lg border border-slate-300 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Type
            <select name="type" defaultValue={type} className="h-9 rounded-lg border border-slate-300 px-2 text-sm">
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="alt" value="missing" defaultChecked={missingAlt} className="size-4 accent-navy-900" />
            Missing alt text
          </label>
          <button type="submit" className="h-9 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white">
            Filter
          </button>
          {(q || type || missingAlt) && (
            <Link href="/admin/media/" className="h-9 content-center text-sm text-slate-600 hover:underline">
              Clear
            </Link>
          )}
        </form>
        {rows.length ? (
          <ul className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {rows.map((m) => {
              const isImage = m.mimeType.startsWith("image/");
              return (
                <li key={m.id}>
                  <Link href={`/admin/media/${m.id}/`} className="group block rounded-lg ring-1 ring-slate-200 hover:ring-navy-700">
                    <span className="grid aspect-square place-items-center overflow-hidden rounded-t-lg bg-slate-100">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={adminMediaUrl(m)} alt={m.alt} loading="lazy" className="size-full object-cover" />
                      ) : (
                        <Icon name={m.mimeType.startsWith("video/") ? "external" : "file-text"} className="size-10 text-slate-400" />
                      )}
                    </span>
                    <span className="block px-2.5 py-2">
                      <span className="block truncate text-xs font-medium text-slate-800" title={m.filename}>
                        {m.filename}
                      </span>
                      <span className={cx("block text-[0.68rem]", isImage && !m.alt ? "text-amber-700" : "text-slate-500")}>
                        {isImage && !m.alt ? "No alt text" : `${Math.max(1, Math.round(m.size / 1024))} KB`}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No files found" text="Try a different search or upload a file above." />
        )}
        <Pager page={page} pages={pages} href={href} />
      </Card>
    </>
  );
}
