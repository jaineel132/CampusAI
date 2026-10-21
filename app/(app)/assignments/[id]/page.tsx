import { notFound } from "next/navigation";
import { createClient, getMe } from "@/lib/supabase";
import { plural, relative } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { FileUpload } from "@/components/file-upload";
import { AutoRefresh } from "@/components/auto-refresh";
import { PrecheckCard } from "@/components/precheck";
import { ApprovalCard } from "@/components/approval";
import { Disclosure } from "@/components/disclosure";
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

      {/* Brief starts open only for a student who still has to do the work. */}
      <Disclosure open={me.role === "student" && !mine} className="card p-4"
        title={<span className="section-title">📋 Brief & rubric</span>}
        meta={<span className="text-xs muted">{plural((a.rubric as string[]).length, "rubric item")}{a.file_path && " · original PDF"}</span>}>
        <div className="space-y-3">
          {a.file_path && <a href={`/files/assignment/${a.id}`} target="_blank" className="btn-ghost btn-sm">📄 Original assignment PDF ↗</a>}
          <p className="whitespace-pre-line text-sm">{a.instructions}</p>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide">Rubric</h2>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {(a.rubric as string[]).map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        </div>
      </Disclosure>

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
              <p className="font-bold">📝 Feedback from your professor</p>
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
              <li key={s.id} className="p-4 text-sm">
                <Disclosure open={draftFor.has(s.id)}
                  title={<span className="font-bold">{s.student?.full_name}{s.is_late && <span className="badge ml-2 bg-danger">late</span>}</span>}
                  meta={s.feedback_released_at ? <span className="badge bg-mint">feedback sent</span>
                    : draftFor.has(s.id) ? <span className="badge bg-pink">draft to review</span>
                    : s.precheck_status === "failed" ? <span className="badge bg-danger">pre-check failed</span>
                    : <span className="badge bg-white">agent working…</span>}>
                  <div className="space-y-2">
                    <p className="muted">
                      <a href={`/files/submission/${s.id}`} target="_blank" className="link">{s.file_name}</a> · <LocalTime iso={s.submitted_at} />
                    </p>
                    <p className="muted">Pre-check: {s.precheck_status === "done" ? (s.precheck as Precheck | null)?.summary : s.precheck_status}</p>
                    {draftFor.has(s.id) && <ApprovalCard a={draftFor.get(s.id)!} inline />}
                  </div>
                </Disclosure>
              </li>
            ))}
            {!submissions?.length && <li className="p-4 text-sm text-ink/70">No submissions yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
