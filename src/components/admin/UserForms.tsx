"use client";

import { deleteAuthor, inviteUser, makeResetLink, resendInvite, saveAuthor, setUserActive, signOutEverywhere, updateUser } from "@/app/admin/_actions/users";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { ActionForm, Select, SubmitButton, TextArea, TextInput } from "./ui";

type Option = { value: string; label: string };

const ROLE_OPTIONS: Option[] = (["administrator", "editor", "author"] as const).map((r) => ({ value: r, label: `${ROLE_LABELS[r]} — ${ROLE_DESCRIPTIONS[r]}` }));

export function InviteUserForm({ authors }: { authors: Option[] }) {
  return (
    <ActionForm action={inviteUser} resetOnSuccess>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Full name" name="name" required maxLength={100} />
        <TextInput label="Work email" name="email" type="email" required />
        <Select label="Role" name="role" defaultValue="editor" options={ROLE_OPTIONS} />
        <Select label="Writes as (author profile)" name="authorId" defaultValue="" options={[{ value: "", label: "None" }, ...authors]} hint="Authors need a profile to write articles under their name." />
      </div>
      <div>
        <SubmitButton pendingLabel="Inviting…">Send invitation</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditUserForm({ user, authors, isSelf }: { user: { id: string; name: string; role: string; authorId: string | null }; authors: Option[]; isSelf: boolean }) {
  return (
    <ActionForm action={updateUser}>
      <input type="hidden" name="id" value={user.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Full name" name="name" defaultValue={user.name} required maxLength={100} />
        <Select label="Role" name="role" defaultValue={user.role} options={ROLE_OPTIONS} disabled={isSelf} hint={isSelf ? "You can't change your own role." : "Changing the role signs them out so the new permissions apply."} />
        {isSelf && <input type="hidden" name="role" value={user.role} />}
        <Select label="Writes as (author profile)" name="authorId" defaultValue={user.authorId ?? ""} options={[{ value: "", label: "None" }, ...authors]} />
      </div>
      <div>
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function UserAccessActions({ id, active, hasPassword, isSelf }: { id: string; active: boolean; hasPassword: boolean; isSelf: boolean }) {
  return (
    <div className="grid gap-5">
      {active && !hasPassword && (
        <ActionForm action={resendInvite}>
          <input type="hidden" name="id" value={id} />
          <p className="text-sm text-slate-600">They haven&apos;t accepted their invitation yet.</p>
          <div>
            <SubmitButton variant="secondary" pendingLabel="Sending…">
              Resend invitation
            </SubmitButton>
          </div>
        </ActionForm>
      )}
      {active && hasPassword && (
        <ActionForm action={makeResetLink}>
          <input type="hidden" name="id" value={id} />
          <p className="text-sm text-slate-600">Create a one-time link to set a new password (for example if they can&apos;t receive email).</p>
          <div>
            <SubmitButton variant="secondary">Create password reset link</SubmitButton>
          </div>
        </ActionForm>
      )}
      <ActionForm action={signOutEverywhere}>
        <input type="hidden" name="id" value={id} />
        <div>
          <SubmitButton variant="secondary" confirm={isSelf ? "This signs you out too. Continue?" : undefined}>
            Sign out on all devices
          </SubmitButton>
        </div>
      </ActionForm>
      {!isSelf && (
        <ActionForm action={setUserActive}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="active" value={active ? "no" : "yes"} />
          <div>
            <SubmitButton variant={active ? "danger" : "primary"} confirm={active ? "Deactivate this account? They will be signed out and unable to sign in." : undefined}>
              {active ? "Deactivate account" : "Reactivate account"}
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

export type AuthorValues = { id?: string; name: string; slug: string; role: string; bio: string; photoId: string | null; seoTitle: string; seoDescription: string };

export function AuthorForm({ author, photos }: { author: AuthorValues; photos: Option[] }) {
  return (
    <ActionForm action={saveAuthor}>
      {author.id && <input type="hidden" name="id" value={author.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Name" name="name" defaultValue={author.name} required maxLength={100} />
        <TextInput label="URL slug" name="slug" defaultValue={author.slug} maxLength={90} hint={`Profile page: /author/${author.slug || "name"}/ — changing it changes the URL.`} />
        <TextInput label="Title / role" name="role" defaultValue={author.role} maxLength={100} placeholder="e.g. Principal Partner" />
        <Select label="Photo" name="photoId" defaultValue={author.photoId ?? ""} options={[{ value: "", label: "No photo (initial shown)" }, ...photos]} hint="Upload the photo in the media library first." />
        <TextArea label="Short bio" name="bio" defaultValue={author.bio} rows={4} maxLength={2000} className="md:col-span-2" hint="Shown under each article and on the author page. Only include verified qualifications." />
        <TextInput label="SEO title (optional)" name="seoTitle" defaultValue={author.seoTitle} maxLength={120} />
        <TextInput label="SEO description (optional)" name="seoDescription" defaultValue={author.seoDescription} maxLength={300} />
      </div>
      <div>
        <SubmitButton>{author.id ? "Save author" : "Create author"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteAuthorForm({ id }: { id: string }) {
  return (
    <ActionForm action={deleteAuthor}>
      <input type="hidden" name="id" value={id} />
      <div>
        <SubmitButton variant="danger" confirm="Delete this author profile?">
          Delete author
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
