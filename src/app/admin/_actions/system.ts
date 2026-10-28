"use server";

import { z } from "zod";
import { adminAction } from "@/lib/admin/action";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { retryEmail } from "@/lib/email/outbox";

export async function retryEmailAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("email.view", async (user) => {
    const id = z.uuid().safeParse(fd.get("id"));
    if (!id.success) return fail("Invalid email.");
    await retryEmail(id.data);
    await audit({ userId: user.id, action: "email.retry", entityType: "email", entityId: id.data });
    return ok("Retried — refresh to see the result.");
  });
}
