import Link from "next/link";
import { createClient, getMe } from "@/lib/supabase";
import { isPast, olderThanHours, plural, relative } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";
import { FileUpload } from "@/components/file-upload";
import { AutoRefresh } from "@/components/auto-refresh";
import { AgentLabel } from "@/components/precheck";
import { ApprovalCard } from "@/components/approval";
import { CreateAssignmentForm } from "./create-form";
import { finishBrief, startBrief } from "./actions";

export default async function AssignmentsPage() {
  const me = await getMe();
  const db = await createClient();
  // RLS limits rows: students see enrolled courses, professors their own, admins the college.
  const isProf = me.role === "professor";
  const [{ data: assignments }, { data: submissions }, { data: courses }, { data: drafts }, { data: lastRun }] = await Promise.all([
    db.from("assignments").select("id, title, due_at, course:courses(code), submissions(count)").order("due_at"),
    db.from("submissions").select("assignment_id, is_late").eq("student_id", me.id),
    isProf ? db.from("courses").select("id, code, name").eq("professor_id", me.id).order("code") : Promise.resolve({ data: null }),
    // RLS: only this course's professor sees the drafts and their own agent runs.
    isProf ? db.from("approvals").select("id, kind, payload, created_at").eq("kind", "assignment_draft").eq("status", "pending").order("created_at", { ascending: false }) : Promise.resolve({ data: null }),
    isProf ? db.from("agent_runs").select("status, error, input, started_at").eq("agent", "assignment").eq("user_id", me.id).order("started_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const reading = lastRun?.status === "running" && !olderThanHours(lastRun.started_at, 0.1);
  const lastFile = (lastRun?.input as { file_name?: string } | null)?.file_name;
  const mine = new Map((submissions ?? []).map((s) => [s.assignment_id, s]));

  return (
    <div className="max-w-3xl space-y-6">
      <AutoRefresh active={reading} />
      <h1 className="heading">Assignments</h1>
      {courses && courses.length > 0 && (
        <section className="space-y-4 card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">Upload an assignment PDF</h2>
            <AgentLabel name="Assignment agent" />
          </div>
          <p className="text-sm text-ink/70">The Assignment agent reads your PDF and drafts the title, instructions, rubric and deadline. Students see nothing until you approve.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((c) => (
              <div key={c.id} className="space-y-1 text-sm">
                <p className="font-medium">{c.code} — {c.name}</p>
                <FileUpload label="Upload assignment PDF" start={startBrief.bind(null, c.id)} finish={finishBrief.bind(null, c.id)} />
              </div>
            ))}
          </div>
          {reading && <p className="text-sm text-ink/70">The Assignment agent is reading {lastFile}…</p>}
          {lastRun?.status === "failed" && (
            <p role="alert" className="text-sm text-danger-ink">Couldn&apos;t draft from {lastFile}: {lastRun.error?.slice(0, 120)} Upload it again, or create the assignment by hand.</p>
          )}
          {(drafts ?? []).map((d) => <ApprovalCard key={d.id} a={d} inline />)}
          <details>
            <summary className="cursor-pointer text-sm text-ink/70 underline">Or create an assignment by hand</summary>
            <div className="mt-3"><CreateAssignmentForm courses={courses} /></div>
          </details>
        </section>
      )}

      <ul className="space-y-3">
        {(assignments ?? []).map((a) => {
          const sub = mine.get(a.id);
          return (
            <li key={a.id}>
              <Link href={`/assignments/${a.id}`} className="card-link flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-bold">{a.title}</p>
                  <p className="mt-1 text-xs text-ink/70">
                    <span className="badge bg-sky">{a.course?.code}</span> due <LocalTime iso={a.due_at} /> ({relative(a.due_at)})
                  </p>
                </div>
                {me.role === "student" ? (
                  <StatusBadge submitted={!!sub} late={sub?.is_late} overdue={isPast(a.due_at)} />
                ) : (
                  <span className="badge bg-white">{plural(a.submissions?.[0]?.count ?? 0, "submission")}</span>
                )}
              </Link>
            </li>
          );
        })}
        {!assignments?.length && <li className="card p-4 text-sm text-ink/70">No assignments yet.</li>}
      </ul>
    </div>
  );
}
