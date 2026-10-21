"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient, getMe } from "@/lib/supabase";
import { safeName } from "@/lib/format";
import { submissionAgent } from "@/lib/agents";

export async function createAssignment(_: string | null, form: FormData) {
  const me = await getMe();
  if (me.role !== "professor") return "Only professors can create assignments.";

  const course_id = String(form.get("course_id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const instructions = String(form.get("instructions") ?? "").trim();
  const rubric = String(form.get("rubric") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const due = new Date(String(form.get("due_at") ?? ""));
  if (!title || !instructions) return "Title and instructions are required.";
  if (!rubric.length) return "Add at least one rubric item.";
  if (isNaN(due.getTime()) || due.getTime() < Date.now()) return "Deadline must be in the future.";

  // RLS only allows inserting into courses this professor teaches.
  const db = await createClient();
  const { data, error } = await db
    .from("assignments")
    .insert({ institution_id: me.institution.id, course_id, title, instructions, rubric, due_at: due.toISOString(), created_by: me.id })
    .select("id")
    .single();
  if (error) return "Could not create the assignment for that course.";
  redirect(`/assignments/${data.id}`);
}

const pathPrefix = (inst: string, assignmentId: string, studentId: string) => `${inst}/${assignmentId}/${studentId}/`;

// Step 1: check the student can submit, then issue a one-time upload URL.
export async function startSubmission(assignmentId: string, fileName: string) {
  const me = await getMe();
  if (me.role !== "student") return { error: "Only students can submit." };
  const db = await createClient();
  const { data: a } = await db.from("assignments").select("id").eq("id", assignmentId).maybeSingle(); // RLS: enrolled only
  if (!a) return { error: "Assignment not found." };

  const path = pathPrefix(me.institution.id, a.id, me.id) + `${crypto.randomUUID()}-${safeName(fileName)}`;
  const { data, error } = await createServiceClient().storage.from("submissions").createSignedUploadUrl(path);
  if (error) return { error: "Could not start the upload." };
  return { bucket: "submissions", path, token: data.token };
}

// Step 2: confirm the file landed, then save (or replace) the one submission row.
export async function finishSubmission(assignmentId: string, path: string, fileName: string) {
  const me = await getMe();
  if (me.role !== "student") return { error: "Only students can submit." };
  if (!path.startsWith(pathPrefix(me.institution.id, assignmentId, me.id)) || path.includes("..")) return { error: "Invalid upload." };

  const db = await createClient();
  const { data: a } = await db.from("assignments").select("id, due_at").eq("id", assignmentId).maybeSingle();
  if (!a) return { error: "Assignment not found." };

  const service = createServiceClient(); // checks above passed; RLS has no student write policy
  const storage = service.storage.from("submissions");
  const { error: missing } = await storage.info(path); // bucket already enforced type + size
  if (missing) return { error: "Upload not found. Try again." };

  const { data: previous } = await db.from("submissions").select("file_path").eq("assignment_id", a.id).eq("student_id", me.id).maybeSingle();
  const { data: saved, error } = await service.from("submissions").upsert(
    {
      institution_id: me.institution.id, assignment_id: a.id, student_id: me.id, file_path: path, file_name: fileName.slice(0, 200),
      is_late: Date.now() > new Date(a.due_at).getTime(), precheck: null, precheck_status: "pending", feedback: null, feedback_released_at: null, submitted_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,student_id" }
  ).select("id").single();
  if (error) {
    await storage.remove([path]);
    return { error: "Could not save the submission." };
  }
  if (previous && previous.file_path !== path) await storage.remove([previous.file_path]);

  after(() => submissionAgent(saved.id));

  revalidatePath(`/assignments/${a.id}`);
  return {};
}

// Re-run a failed pre-check (AI provider down, quota hit).
export async function retryPrecheck(submissionId: string) {
  const me = await getMe();
  const db = await createClient();
  const { data: s } = await db.from("submissions").select("id, assignment_id").eq("id", submissionId).eq("student_id", me.id).maybeSingle();
  if (!s) return;
  after(() => submissionAgent(s.id));
  revalidatePath(`/assignments/${s.assignment_id}`);
}
