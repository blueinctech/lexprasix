import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CopyButton, MediaDeleteForm, MediaDetailsForm, MediaReplace } from "@/components/admin/MediaLibrary";
import { Card, formatDateTime, PageTitle } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { getDb } from "@/db";
import { media, users } from "@/db/schema";
import { adminMediaUrl, extOf, MEDIA_TYPES, mediaReferences } from "@/lib/admin/media";
import { requireUserPage } from "@/lib/auth/current";
import { can } from "@/lib/auth/permissions";
import { mediaUrl } from "@/lib/storage";

export const metadata: Metadata = { title: "Media file" };

export default async function MediaDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage("media.upload");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [row] = await db.select({ m: media, uploader: users.name }).from(media).leftJoin(users, eq(users.id, media.uploadedById)).where(eq(media.id, id));
  if (!row) notFound();
  const m = row.m;
  const refs = await mediaReferences(m);
  const preview = adminMediaUrl(m);
  const publicUrl = mediaUrl(m.key);
  const isImage = m.mimeType.startsWith("image/");
  const manage = can(user.role, "media.manage");
  const canEdit = manage || m.uploadedById === user.id;
  const sameType = Object.entries(MEDIA_TYPES)
    .filter(([, t]) => t.mime === m.mimeType)
    .map(([e]) => e)
    .join(",") || extOf(m.key);

  return (
    <>
      <PageTitle title={m.filename} back={{ href: "/admin/media/", label: "Media library" }} actions={<CopyButton text={publicUrl} />} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card padded={false}>
          <div className="grid min-h-72 place-items-center bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:20px_20px] p-6">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={m.alt} className="max-h-[32rem] max-w-full rounded object-contain shadow" />
            ) : m.mimeType.startsWith("video/") ? (
              <video src={preview} controls className="max-h-[32rem] max-w-full rounded" />
            ) : (
              <a href={preview} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 text-sm text-navy-700 hover:underline">
                <Icon name="file-text" className="size-14 text-slate-400" />
                Open file
              </a>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-100 p-5 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Type</dt>
              <dd>{m.mimeType}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Size</dt>
              <dd>{m.size >= 1024 * 1024 ? `${(m.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(m.size / 1024))} KB`}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Dimensions</dt>
              <dd>{m.width && m.height ? `${m.width} × ${m.height}px` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Added</dt>
              <dd>
                {formatDateTime(m.createdAt)}
                {row.uploader ? ` by ${row.uploader}` : m.wpId ? " (from WordPress)" : ""}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-xs text-slate-500">Public URL</dt>
              <dd className="break-all font-mono text-xs">{publicUrl}</dd>
            </div>
            {m.legacyUrl && (
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-xs text-slate-500">Original WordPress URL</dt>
                <dd className="break-all font-mono text-xs">{m.legacyUrl}</dd>
              </div>
            )}
          </dl>
        </Card>
        <div className="grid content-start gap-6">
          <Card title="Details">
            {canEdit ? (
              <MediaDetailsForm id={m.id} alt={m.alt} caption={m.caption} description={m.description} isImage={isImage} />
            ) : (
              <p className="text-sm text-slate-600">You can edit details of files you uploaded. Ask an editor to change this one.</p>
            )}
          </Card>
          <Card title={`Used in (${refs.length})`}>
            {refs.length ? (
              <ul className="grid gap-2 text-sm">
                {refs.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className="text-navy-700 hover:underline">
                      {r.title}
                    </Link>{" "}
                    <span className="text-xs text-slate-500">· {r.type}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Not used in any page, article, service, legal document or author profile.</p>
            )}
          </Card>
          {manage && (
            <>
              <Card title="Replace file">
                <p className="mb-3 text-sm text-slate-600">Upload a new version with the same file type. The URL stays the same, so every page using it updates.</p>
                <MediaReplace mediaId={m.id} accept={sameType} />
              </Card>
              <Card title="Delete">
                <MediaDeleteForm id={m.id} referenced={refs.length > 0} />
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
