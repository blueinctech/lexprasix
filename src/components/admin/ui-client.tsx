"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { IDLE, type ActionState } from "@/lib/admin/types";
import { btn, cx, type ButtonVariant } from "./ui";

// Admin UI kit. Calm SaaS styling: white cards on a cool-grey canvas, navy
// primary actions, compact type. Every form is a real <form> bound to a Server
// Action with useActionState, so it works before hydration and errors show
// next to their fields.

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({ children, pendingLabel = "Saving…", variant = "primary", small, name, value, confirm }: { children: ReactNode; pendingLabel?: string; variant?: ButtonVariant; small?: boolean; name?: string; value?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={btn(variant, small)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  const okState = state.status === "ok";
  return (
    <div role={okState ? "status" : "alert"} className={cx("rounded-lg px-4 py-3 text-sm", okState ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900")}>
      {state.message}
      {okState && state.data?.link && <p className="mt-2 break-all font-mono text-xs">{state.data.link}</p>}
    </div>
  );
}

/** A form bound to a Server Action, with its result shown above the fields. */
export function ActionForm({ action, children, className, onSuccess, resetOnSuccess }: { action: FormAction; children: ReactNode; className?: string; onSuccess?: (s: ActionState) => void; resetOnSuccess?: boolean }) {
  const [state, formAction] = useActionState(action, IDLE);
  const ref = useRef<HTMLFormElement>(null);
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.status === "ok") {
      onSuccess?.(state);
      if (resetOnSuccess) ref.current?.reset();
    }
  }, [state, onSuccess, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={cx("grid gap-5", className)}>
      <ActionMessage state={state} />
      <FieldErrorsContext errors={state.errors}>{children}</FieldErrorsContext>
    </form>
  );
}

// Field-level errors are passed through a data attribute lookup so fields can
// stay simple server-friendly components.
function FieldErrorsContext({ errors, children }: { errors?: Record<string, string>; children: ReactNode }) {
  return (
    <>
      {children}
      {errors && Object.keys(errors).length > 0 && (
        <ul className="sr-only">
          {Object.entries(errors).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      )}
      {errors && <ErrorPainter errors={errors} />}
    </>
  );
}

/** Marks inputs named in `errors` as invalid and shows the message below them. */
function ErrorPainter({ errors }: { errors: Record<string, string> }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    form.querySelectorAll("[data-field-error]").forEach((n) => n.remove());
    form.querySelectorAll("[aria-invalid='true']").forEach((n) => n.removeAttribute("aria-invalid"));
    let first: HTMLElement | null = null;
    for (const [name, message] of Object.entries(errors)) {
      const input = form.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
      if (!input) continue;
      input.setAttribute("aria-invalid", "true");
      const p = document.createElement("p");
      p.dataset.fieldError = "";
      p.className = "mt-1 text-xs font-medium text-red-700";
      p.textContent = message;
      input.closest("[data-field]")?.appendChild(p);
      first ??= input;
    }
    first?.focus();
  }, [errors]);
  return <span ref={ref} hidden />;
}

const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15 aria-[invalid=true]:border-red-600 disabled:bg-slate-50";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div data-field className={cx("grid gap-1.5", className)}>
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

export function TextInput({ label, hint, className, ...props }: { label: string; hint?: ReactNode; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div data-field className={cx("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
        {props.required && <span className="text-red-700"> *</span>}
      </label>
      <input id={id} {...props} className={inputCls} />
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

export function TextArea({ label, hint, className, ...props }: { label: string; hint?: ReactNode; className?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div data-field className={cx("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
        {props.required && <span className="text-red-700"> *</span>}
      </label>
      <textarea id={id} rows={props.rows ?? 3} {...props} className={inputCls} />
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

export function Select({ label, hint, options, className, ...props }: { label: string; hint?: ReactNode; options: { value: string; label: string }[]; className?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div data-field className={cx("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <select id={id} {...props} className={inputCls}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

export function Checkbox({ label, hint, ...props }: { label: string; hint?: ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div data-field className="flex items-start gap-2.5">
      <input id={id} type="checkbox" {...props} className="mt-0.5 size-4 rounded border-slate-300 accent-navy-900" />
      <label htmlFor={id} className="text-sm text-slate-800">
        {label}
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </label>
    </div>
  );
}

export type NavItem = { href: string; label: string; icon: string; count?: number; group?: string };

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-0.5 text-sm" aria-label="Admin">
      {items.map((i, idx) => {
        const active = i.href === "/admin/" ? pathname === "/admin/" : pathname.startsWith(i.href);
        const heading = i.group && i.group !== items[idx - 1]?.group ? i.group : null;
        return (
          <div key={i.href}>
            {heading && <p className="mt-5 mb-1.5 px-3 text-[0.68rem] font-semibold tracking-[0.12em] text-slate-400 uppercase">{heading}</p>}
            <Link href={i.href} aria-current={active ? "page" : undefined} className={cx("flex items-center gap-3 rounded-lg px-3 py-2 transition-colors", active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white")}>
              <Icon name={i.icon} className="size-4 opacity-80" />
              <span className="flex-1">{i.label}</span>
              {i.count ? <span className="rounded-full bg-gold-500 px-1.5 text-[0.68rem] font-semibold text-navy-950">{i.count}</span> : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

