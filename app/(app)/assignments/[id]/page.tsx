import { notFound } from "next/navigation";
import { createClient, getMe } from "@/lib/supabase";
import { relative } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { FileUpload } from "@/components/file-upload";
import { AutoRefresh } from "@/components/auto-refresh";
import { PrecheckCard } from "@/components/precheck";
import { ApprovalCard } from "@/components/approval";
import type { Precheck } from "@/lib/agents";
import { finishSubmission, retryPrecheck, startSubmission } from "../actions";

export default async function AssignmentPage(props: PageProps<"/assignments/[id]">) {
  const { id } = await props.params;
  const me = await getMe();
  const db = await createClient();
  const { data: a } = await db
    .from("assignments")
    .select("id, title, instructions, rubric, due_at, file_path, course:courses(code, name)")
    .eq("id", id)
    .maybeSingle();
  if (!a) notFound(); // not visible under RLS = doesn't exist for this user

  // RLS: a student gets only their own row; a professor gets every submission for their course.
  const { data: submissions } = await db
    .from("submissions")
    .select("id, file_name, submitted_at, is_late, precheck, precheck_status, feedback, feedback_released_at, student:profiles(full_name)")
    .eq("assignment_id", a.id)
    .order("submitted_at", { ascending: false });
  // RLS: only the course's professor sees pending feedback drafts.
  const { data: drafts } = await db.from("approvals").select("id, kind, payload, created_at").eq("kind", "feedback_draft").eq("status", "pending").eq("payload->>assignment_id", a.id);
  const draftFor = new Map((drafts ?? []).map((d) => [(d.payload as { submission_id?: string }).submission_id, d]));
  const mine = me.role === "student" ? submissions?.[0] : undefined;
  const pending = (submissions ?? []).some((s) => s.precheck_status === "pending");

  return (
    <div className="max-w-3xl space-y-6">
      <AutoRefresh active={pending} />
      <div>
        <p className="text-sm text-ink/70"><span className="badge bg-sky">{a.course?.code}</span> {a.course?.name}</p>
        <h1 className="heading mt-2">{a.title}</h1>
        <p className="mt-2"><span className="badge bg-yellow">Due <LocalTime iso={a.due_at} /> · {relative(a.due_at)}</span></p>
      </div>

      <section className="space-y-3 card p-5">
        {a.file_path && (
          <p className="text-sm">📄 <a href={`/files/assignment/${a.id}`} target="_blank" className="link">Original assignment PDF</a></p>
        )}
        <p className="whitespace-pre-line text-sm">{a.instructions}</p>
        <div>
          <h2 className="text-sm font-medium">Rubric</h2>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {(a.rubric as string[]).map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      </section>

      {me.role === "student" && (
        <section className="space-y-3 card p-5">
          <h2 className="section-title">Your submission</h2>
          {mine ? (
            <p className="text-sm">
              ✓ <a href={`/files/submission/${mine.id}`} target="_blank" className="link">{mine.file_name}</a>
              {" saved "}<LocalTime iso={mine.submitted_at} />
              {mine.is_late && <span className="text-danger-ink"> (late)</span>}
            </p>
          ) : (
            <p className="text-sm text-ink/70">Nothing submitted yet. PDF or TXT, up to 10 MB.</p>
          )}
          {mine && (
            <PrecheckCard status={mine.precheck_status} precheck={mine.precheck as Precheck | null} retry={retryPrecheck.bind(null, mine.id)} />
          )}
          {mine?.feedback_released_at && (
            <div className="rounded-md border-2 border-ink bg-mint p-4 text-sm">
              <p className="font-medium">Feedback from your professor</p>
              <p className="mt-1 whitespace-pre-line">{mine.feedback}</p>
            </div>
          )}
          <FileUpload
            label={mine ? "Replace submission" : "Submit"}
            start={startSubmission.bind(null, a.id)}
            finish={finishSubmission.bind(null, a.id)}
          />
        </section>
      )}

      {me.role !== "student" && (
        <section className="card">
          <h2 className="border-b-2 border-ink p-4 font-bold">Submissions ({submissions?.length ?? 0})</h2>
          <ul className="divide-y divide-ink/15">
            {(submissions ?? []).map((s) => (
              <li key={s.id} className="space-y-1 p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{s.student?.full_name}</span>
                  <span className="text-ink/70">
                    <a href={`/files/submission/${s.id}`} target="_blank" className="link">{s.file_name}</a>
                    {" · "}<LocalTime iso={s.submitted_at} />
                    {s.is_late && <span className="text-danger-ink"> · late</span>}
                  </span>
                </div>
                <p className="text-ink/70">
                  Pre-check: {s.precheck_status === "done" ? (s.precheck as Precheck | null)?.summary : s.precheck_status}
                  {" · "}
                  {s.feedback_released_at ? "feedback sent" : draftFor.has(s.id) ? "feedback draft below" : "waiting for the Submission agent"}
                </p>
                {draftFor.has(s.id) && <div className="pt-2"><ApprovalCard a={draftFor.get(s.id)!} inline /></div>}
              </li>
            ))}
            {!submissions?.length && <li className="p-4 text-sm text-ink/70">No submissions yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
