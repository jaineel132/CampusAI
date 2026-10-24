"use server";

import { revalidatePath } from "next/cache";
import { createClient, getMe } from "@/lib/supabase";
import { decideApproval, EDITABLE_KEYS, type Db } from "@/lib/approvals";

// Approve (optionally with edits) or reject, as the signed-in reviewer (RLS applies).
export async function decide(approvalId: string, _: string | null, form: FormData): Promise<string | null> {
  const me = await getMe();
  if (me.role === "student") return "Not allowed.";
  const decision = form.get("decision") === "approve" ? "approved" : "rejected";
  const edits = Object.fromEntries(EDITABLE_KEYS.map((k) => [k, String(form.get(k) ?? "")]));
  // The user's RLS client has the same API as the service client; the cast only bridges the two generic types.
  const db = (await createClient()) as unknown as Db;
  const error = await decideApproval(db, approvalId, me.id, decision, edits);
  if (!error) {
    revalidatePath("/inbox");
    revalidatePath("/", "layout");
  }
  return error;
}
