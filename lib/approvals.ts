import "server-only";
import { createServiceClient } from "./supabase";
import type { Json } from "./database.types";

type Payload = Record<string, Json>;
// The signed-in user's client (RLS) or the service client (demo setup). Same API either way.
export type Db = ReturnType<typeof createServiceClient>;

export const EDITABLE_KEYS = ["title", "body", "feedback", "message", "instructions", "rubric", "due_at"];

// Approve (optionally with edits) or reject an agent-prepared item.
// The agent never writes the final record: this function does, as the approving human.
export async function decideApproval(
  db: Db,
  approvalId: string,
  reviewerId: string,
  decision: "approved" | "rejected",
  edits: Record<string, string> = {}
): Promise<string | null> {
  // Claim it atomically. RLS only lets the right reviewer update; status filter stops double-approval.
  const { data: approval } = await db
    .from("approvals")
    .update({ status: decision, decided_by: reviewerId, decided_at: new Date().toISOString() })
    .eq("id", approvalId)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (!approval) return "Already decided, or not yours to review.";
  if (decision === "rejected") return null;

  const payload = { ...(approval.payload as Payload) };
  for (const key of EDITABLE_KEYS) if (edits[key]?.trim()) payload[key] = edits[key].trim();

  const error = await apply(db, approval.kind, approval, payload, reviewerId);
  if (error) {
    await db.from("approvals").update({ status: "pending", decided_by: null, decided_at: null }).eq("id", approval.id);
    return error;
  }
  await db.from("approvals").update({ payload }).eq("id", approval.id);
  return null;
}

async function apply(
  db: Db,
  kind: string,
  approval: { id: string; institution_id: string; course_id: string | null },
  p: Payload,
  reviewerId: string
): Promise<string | null> {
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

  if (kind === "reminder_batch") {
    // Only send to students who really belong to this college and still owe on that fee.
    const items = (p.students as { student_id: string; fee_id: string; description: string }[]) ?? [];
    const { data: fees } = await service
      .from("fee_records")
      .select("id, student_id, description, due_date")
      .eq("institution_id", approval.institution_id)
      .neq("status", "paid")
      .in("id", items.map((i) => i.fee_id));
    if (!fees?.length) return "All of these fees are already paid.";
    const day = new Date().toISOString().slice(0, 10);
    await service.from("notifications").upsert(
      fees.map((f) => ({
        institution_id: approval.institution_id, user_id: f.student_id, kind: "fee_reminder", link: "/fees",
        title: `Fee reminder from the college: ${f.description} (due ${f.due_date})`, body: String(p.message), ref: `batch:${f.id}:${day}`,
      })),
      { onConflict: "user_id,ref", ignoreDuplicates: true }
    );
    return null;
  }

  if (kind === "assignment_draft") {
    // Same rules as creating one by hand. RLS only lets the course's professor insert.
    const title = String(p.title ?? "").trim();
    const instructions = String(p.instructions ?? "").trim();
    const rubric = (Array.isArray(p.rubric) ? p.rubric.map(String) : String(p.rubric ?? "").split("\n")).map((l) => l.trim()).filter(Boolean);
    const due = new Date(String(p.due_at ?? ""));
    if (!title || !instructions) return "Title and instructions are required.";
    if (!rubric.length) return "Add at least one rubric item.";
    if (isNaN(due.getTime()) || due.getTime() < Date.now()) return "Set a deadline in the future (under “Edit before approving”).";
    const { error } = await db.from("assignments").insert({
      institution_id: approval.institution_id, course_id: approval.course_id!, title, instructions, rubric,
      due_at: due.toISOString(), created_by: reviewerId, file_path: String(p.file_path),
    });
    return error ? "Could not create the assignment." : null;
  }

  return `Approving "${kind}" is not supported yet.`;
}
