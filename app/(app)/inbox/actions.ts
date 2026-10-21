"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient, getMe } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

type Payload = Record<string, Json>;

// Approve (optionally with edits) or reject an agent-prepared item.
// The agent never writes the final record: this backend function does, as the approving human.
export async function decide(approvalId: string, _: string | null, form: FormData): Promise<string | null> {
  const me = await getMe();
  if (me.role === "student") return "Not allowed.";
  const decision = form.get("decision") === "approve" ? "approved" : "rejected";
  const db = await createClient();

  // Claim it atomically. RLS only lets the right reviewer update; status filter stops double-approval.
  const { data: approval } = await db
    .from("approvals")
    .update({ status: decision, decided_by: me.id, decided_at: new Date().toISOString() })
    .eq("id", approvalId)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (!approval) return "Already decided, or not yours to review.";
  if (decision === "rejected") return done();

  const payload = { ...(approval.payload as Payload) };
  for (const key of ["title", "body", "feedback"]) {
    const v = form.get(key);
    if (typeof v === "string" && v.trim()) payload[key] = v.trim();
  }

  const error = await apply(approval.kind, approval, payload, me.id);
  if (error) {
    await db.from("approvals").update({ status: "pending", decided_by: null, decided_at: null }).eq("id", approval.id);
    return error;
  }
  await db.from("approvals").update({ payload }).eq("id", approval.id);
  return done();
}

function done() {
  revalidatePath("/inbox");
  revalidatePath("/", "layout");
  return null;
}

async function apply(
  kind: string,
  approval: { id: string; institution_id: string; course_id: string | null },
  p: Payload,
  reviewerId: string
): Promise<string | null> {
  const db = await createClient();
  const service = createServiceClient();

  if (kind === "announcement") {
    // RLS: professors can only publish to courses they teach, admins college-wide.
    const { error } = await db.from("announcements").insert({
      institution_id: approval.institution_id, course_id: approval.course_id, author_id: reviewerId,
      title: String(p.title), body: String(p.body), approval_id: approval.id,
    });
    return error ? "Could not publish the announcement." : null;
  }

  if (kind === "feedback_draft") {
    // Release feedback only for a submission that belongs to the approval's course.
    const { data: sub } = await service
      .from("submissions")
      .select("id, student_id, institution_id, assignment:assignments!inner(id, title, course_id)")
      .eq("id", String(p.submission_id))
      .eq("assignment.course_id", approval.course_id ?? "")
      .maybeSingle();
    if (!sub?.assignment) return "Submission not found.";
    await service.from("submissions").update({ feedback: String(p.feedback), feedback_released_at: new Date().toISOString() }).eq("id", sub.id);
    await service.from("notifications").insert({
      institution_id: sub.institution_id, user_id: sub.student_id, kind: "feedback",
      title: `Feedback ready: ${sub.assignment.title}`, link: `/assignments/${sub.assignment.id}`,
    });
    return null;
  }

  return `Approving "${kind}" is not supported yet.`;
}
