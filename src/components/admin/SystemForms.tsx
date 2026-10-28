"use client";

import { useActionState } from "react";
import { retryEmailAction } from "@/app/admin/_actions/system";
import { IDLE } from "@/lib/admin/types";
import { SubmitButton } from "./ui";

export function RetryEmailButton({ id }: { id: string }) {
  const [state, action] = useActionState(retryEmailAction, IDLE);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {state.status !== "idle" && <span className={`text-xs ${state.status === "ok" ? "text-emerald-700" : "text-red-700"}`}>{state.message}</span>}
      <SubmitButton small variant="secondary" pendingLabel="Retrying…">
        Retry
      </SubmitButton>
    </form>
  );
}
