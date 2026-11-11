"use client";

import { useEffect, useId, useRef, useState } from "react";
import { submitCommentAction } from "@/app/actions/forms";
import { buttonClass } from "@/components/ui/primitives";

// "Leave a comment" form under blog posts. Comments are held for approval;
// "Reply" buttons on comments target this form.

const inputCls =
  "w-full rounded-[1.875rem] border border-[#e0e0e0] bg-white px-7 py-[1.05rem] text-base text-ink transition-colors placeholder:text-ink-muted/70 hover:border-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-4 focus:ring-gold-500/15 aria-[invalid=true]:border-red-600";
const REPLY_EVENT = "lp-comment-reply";

type ReplyTo = { id: string; name: string };

export function ReplyButton({ id, name }: { id: string; name: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent<ReplyTo>(REPLY_EVENT, { detail: { id, name } }))}
      className="mt-3 text-[0.875rem] font-medium text-heading underline-offset-2 hover:text-gold-500 hover:underline"
    >
      Reply
    </button>
  );
}

export function CommentForm({ postId }: { postId: string }) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const started = useRef(0);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    started.current = Date.now();
    const onReply = (e: Event) => {
      setReplyTo((e as CustomEvent<ReplyTo>).detail);
      setDone("");
      form.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      form.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true });
    };
    window.addEventListener(REPLY_EVENT, onReply);
    return () => window.removeEventListener(REPLY_EVENT, onReply);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    setFields({});
    try {
      const res = await submitCommentAction({
        postId,
        parentId: replyTo?.id ?? null,
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        comment: String(fd.get("comment") ?? ""),
        website: String(fd.get("website") ?? ""),
        elapsedMs: Date.now() - started.current,
      });
      if (res.ok) {
        setDone(res.message);
        setReplyTo(null);
        form.current?.reset();
      } else {
        setError(res.error);
        setFields(res.fields ?? {});
      }
    } catch {
      setError("We couldn't post your comment just now. Please try again later.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-12 rounded-[1.25rem] bg-paper-warm p-6 sm:p-10">
      <h2 id={`${id}-title`} className="text-[1.75rem] font-semibold">
        {replyTo ? `Reply to ${replyTo.name}` : "Leave a comment"}
      </h2>
      <p className="mt-2 text-[0.875rem] text-ink">Your email address won&apos;t be published. Comments appear after they&apos;re approved. For advice on your own matter, please contact us directly.</p>
      {replyTo && (
        <button type="button" onClick={() => setReplyTo(null)} className="mt-2 text-[0.875rem] text-heading underline hover:text-gold-500">
          Cancel reply
        </button>
      )}
      {done ? (
        <p role="status" className="mt-6 rounded-xl bg-white px-5 py-4 text-ink">
          {done}
        </p>
      ) : null}
      <form ref={form} onSubmit={onSubmit} aria-labelledby={`${id}-title`} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-comment`} className="sr-only">
            Comment
          </label>
          <textarea id={`${id}-comment`} name="comment" rows={5} required maxLength={3000} placeholder="Your comment *" aria-invalid={!!fields.comment} className={`${inputCls} rounded-[1.25rem]`} />
          {fields.comment && <p className="mt-1 px-4 text-[0.875rem] text-red-700">{fields.comment}</p>}
        </div>
        <div>
          <label htmlFor={`${id}-name`} className="sr-only">
            Name
          </label>
          <input id={`${id}-name`} name="name" required maxLength={80} autoComplete="name" placeholder="Your name *" aria-invalid={!!fields.name} className={inputCls} />
          {fields.name && <p className="mt-1 px-4 text-[0.875rem] text-red-700">{fields.name}</p>}
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="sr-only">
            Email
          </label>
          <input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" placeholder="Your email *" aria-invalid={!!fields.email} className={inputCls} />
          {fields.email && <p className="mt-1 px-4 text-[0.875rem] text-red-700">{fields.email}</p>}
        </div>
        {/* Hidden from people; bots fill it in. */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0" />
        <div className="sm:col-span-2">
          {error && (
            <p role="alert" className="mb-3 text-[0.875rem] text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Posting…" : replyTo ? "Post reply" : "Post comment"}
          </button>
        </div>
      </form>
    </div>
  );
}
