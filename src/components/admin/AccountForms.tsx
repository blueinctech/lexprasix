"use client";

import { useActionState, useState } from "react";
import { cancelTwoFactorSetupAction, changePassword, confirmTwoFactor, disableTwoFactor, regenerateRecoveryCodesAction, startTwoFactorSetup } from "@/app/admin/_actions/account";
import { IDLE, type ActionState } from "@/lib/admin/types";
import { ActionForm, ActionMessage, btn, SubmitButton, TextInput } from "./ui";

type Status = { enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number };
type Setup = { qr: string; key: string } | null;

const ACTIONS = {
  start: startTwoFactorSetup,
  cancel: cancelTwoFactorSetupAction,
  confirm: confirmTwoFactor,
  regenerate: regenerateRecoveryCodesAction,
  disable: disableTwoFactor,
} as const;

// One action state for the whole card, so the recovery codes returned by
// "confirm" or "regenerate" stay visible after the page re-renders as "on".
async function run(prev: ActionState, fd: FormData): Promise<ActionState> {
  const intent = String(fd.get("intent")) as keyof typeof ACTIONS;
  const action = ACTIONS[intent];
  return action ? action(prev, fd) : prev;
}

const codeInput = { autoComplete: "one-time-code", inputMode: "numeric", pattern: "[0-9 ]*", maxLength: 10, placeholder: "123 456" } as const;

export function TwoFactorPanel({ status, setup }: { status: Status; setup: Setup }) {
  const [state, dispatch] = useActionState(run, IDLE);
  const [dismissed, setDismissed] = useState<ActionState | null>(null);
  const codes = state.data?.codes && dismissed !== state ? state.data.codes.split(" ") : null;

  return (
    <div className="grid gap-5">
      <ActionMessage state={state} />
      {codes && <RecoveryCodes codes={codes} onDone={() => setDismissed(state)} />}

      {!status.enabled && !setup && (
        <form action={dispatch} className="grid gap-4">
          <p className="text-sm text-slate-600">
            Two-factor authentication is <strong>off</strong>. Turn it on so that signing in needs a code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password, Authy…) as well as your password.
          </p>
          <input type="hidden" name="intent" value="start" />
          <div>
            <SubmitButton pendingLabel="Preparing…">Set up two-factor authentication</SubmitButton>
          </div>
        </form>
      )}

      {!status.enabled && setup && (
        <div className="grid gap-5">
          <ol className="grid list-decimal gap-1 pl-5 text-sm text-slate-600">
            <li>Open your authenticator app and add an account.</li>
            <li>Scan the QR code, or type in the key below.</li>
            <li>Enter the 6-digit code the app shows to finish.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- server-generated SVG data URL */}
            <img src={setup.qr} alt="QR code for your authenticator app" width={176} height={176} className="size-44 rounded-lg border border-slate-200 bg-white p-1" />
            <div className="grid gap-1 text-sm">
              <span className="text-slate-500">Key for manual entry (time-based)</span>
              <code data-testid="totp-key" className="rounded-md bg-slate-100 px-2 py-1 font-mono text-sm tracking-wider text-slate-900 select-all">
                {setup.key}
              </code>
            </div>
          </div>
          <form action={dispatch} className="grid max-w-xs gap-4">
            <input type="hidden" name="intent" value="confirm" />
            <TextInput label="Code from the app" name="code" required {...codeInput} />
            <div className="flex gap-2">
              <SubmitButton pendingLabel="Checking…">Turn on</SubmitButton>
            </div>
          </form>
          <form action={dispatch}>
            <input type="hidden" name="intent" value="cancel" />
            <button type="submit" className={btn("ghost", true)}>
              Cancel setup
            </button>
          </form>
        </div>
      )}

      {status.enabled && (
        <div className="grid gap-6">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-emerald-800">On since {status.enabledAt}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Unused recovery codes</dt>
              <dd className={status.recoveryCodesLeft <= 2 ? "font-medium text-amber-800" : undefined}>{status.recoveryCodesLeft}</dd>
            </div>
          </dl>
          <form action={dispatch} className="grid max-w-xs gap-3 border-t border-slate-100 pt-5">
            <input type="hidden" name="intent" value="regenerate" />
            <p className="text-sm font-medium text-slate-900">New recovery codes</p>
            <p className="text-xs text-slate-500">Replaces all your recovery codes. Needs a code from your app.</p>
            <TextInput label="Code from the app" name="code" required {...codeInput} />
            <div>
              <SubmitButton variant="secondary" pendingLabel="Creating…">
                Generate new recovery codes
              </SubmitButton>
            </div>
          </form>
          <form action={dispatch} className="grid max-w-xs gap-3 border-t border-slate-100 pt-5">
            <input type="hidden" name="intent" value="disable" />
            <p className="text-sm font-medium text-slate-900">Turn off two-factor authentication</p>
            <TextInput label="Current password" name="password" type="password" autoComplete="current-password" required />
            <TextInput label="Code from the app or a recovery code" name="code" autoComplete="one-time-code" maxLength={20} required />
            <div>
              <SubmitButton variant="danger" pendingLabel="Turning off…" confirm="Turn off two-factor authentication? Your account will be protected by your password only.">
                Turn off
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  const download = `data:text/plain;charset=utf-8,${encodeURIComponent(`LexPraxis admin recovery codes\nEach code works once.\n\n${text}\n`)}`;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-950">Save your recovery codes</p>
      <p className="mt-1 text-sm text-amber-900">If you lose your phone, each of these codes lets you sign in once. They won&apos;t be shown again — keep them somewhere safe, like a password manager.</p>
      <ul data-testid="recovery-codes" className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-slate-900 sm:max-w-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={btn("secondary", true)}
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a className={btn("secondary", true)} href={download} download="lexpraxis-recovery-codes.txt">
          Download
        </a>
        <button type="button" className={btn("primary", true)} onClick={onDone}>
          I&apos;ve saved them
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePassword} resetOnSuccess className="max-w-sm">
      <TextInput label="Current password" name="current" type="password" autoComplete="current-password" required />
      <TextInput label="New password" name="password" type="password" autoComplete="new-password" required minLength={12} hint="At least 12 characters. A short sentence works well." />
      <TextInput label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
      <div>
        <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
      </div>
    </ActionForm>
  );
}
