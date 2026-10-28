"use client";

import { forgotPassword, login, setPassword } from "@/app/admin/_actions/auth";
import { ActionForm, SubmitButton, TextInput } from "./ui";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={login}>
      {next && <input type="hidden" name="next" value={next} />}
      <TextInput label="Email" name="email" type="email" autoComplete="username" required autoFocus />
      <TextInput label="Password" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </ActionForm>
  );
}

export function ForgotForm() {
  return (
    <ActionForm action={forgotPassword} resetOnSuccess>
      <TextInput label="Email" name="email" type="email" autoComplete="username" required autoFocus />
      <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
    </ActionForm>
  );
}

export function SetPasswordForm({ purpose, token }: { purpose: "invite" | "reset"; token: string }) {
  return (
    <ActionForm action={setPassword}>
      <input type="hidden" name="purpose" value={purpose} />
      <input type="hidden" name="token" value={token} />
      <TextInput label="New password" name="password" type="password" autoComplete="new-password" required minLength={12} hint="At least 12 characters. A short sentence works well." />
      <TextInput label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
      <SubmitButton pendingLabel="Saving…">{purpose === "invite" ? "Set password and sign in" : "Reset password and sign in"}</SubmitButton>
    </ActionForm>
  );
}
