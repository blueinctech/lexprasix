"use server";

import { getRequestContext } from "@/lib/security/request";
import { submitForm as submit, type SubmitPayload, type SubmitResult } from "@/forms/server";

// Public form submission. Server Actions check the Origin header against the
// host (CSRF protection); all validation happens in submitForm.
export async function submitFormAction(payload: SubmitPayload): Promise<SubmitResult> {
  return submit(payload, await getRequestContext());
}
