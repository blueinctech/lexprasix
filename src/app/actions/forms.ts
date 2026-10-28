"use server";

import { submitForm as submit, type SubmitPayload, type SubmitResult } from "@/forms/server";
import { logger } from "@/lib/security/logger";
import { getRequestContext } from "@/lib/security/request";

// Public form submission. Server Actions check the Origin header against the
// host (CSRF protection); all validation happens in submitForm. Unexpected
// failures (e.g. missing configuration) still give the visitor a clear way to reach us.
export async function submitFormAction(payload: SubmitPayload): Promise<SubmitResult> {
  try {
    return await submit(payload, await getRequestContext());
  } catch (err) {
    logger.error("Form submission crashed", { formId: payload?.formId, err });
    return { status: "error", message: "We couldn't send your request just now. Please try again, call us, or email info@lexpraxisng.com." };
  }
}
