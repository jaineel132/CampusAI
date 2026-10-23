import Link from "next/link";
import { createClient, getMe } from "@/lib/supabase";
import { isPast, olderThanHours, plural, relative } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";
import { FileUpload } from "@/components/file-upload";
import { AutoRefresh } from "@/components/auto-refresh";
import { AgentLabel } from "@/components/precheck";
import { ApprovalCard } from "@/components/approval";
import { Disclosure } from "@/components/disclosure";
import { CreateAssignmentForm } from "./create-form";
import { finishBrief, startBrief } from "./actions";

export default async function AssignmentsPage() {
  const me = await getMe();
  const db = await createClient();
  // RLS limits rows: students see enrolled courses, professors their own, admins the college.
  const isProf = me.role === "professor";
  const [{ data: assignments }, { data: submissions }, { data: courses }, { data: drafts }, { data: lastRun }] = await Promise.all([
    db.from("assignments").select("id, title, due_at, course:courses(code, name), submissions(count)").order("due_at"),
    db.from("submissions").select("assignment_id, is_late").eq("student_id", me.id),
    isProf ? db.from("courses").select("id, code, name").eq("professor_id", me.id).order("code") : Promise.resolve({ data: null }),
    // RLS: only this course's professor sees the drafts and their own agent runs.
    isProf ? db.from("approvals").select("id, kind, payload, created_at").eq("kind", "assignment_draft").eq("status", "pending").order("created_at", { ascending: false }) : Promise.resolve({ data: null }),
    isProf ? db.from("agent_runs").select("status, error, input, started_at").eq("agent", "assignment").eq("user_id", me.id).order("started_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const reading = lastRun?.status === "running" && !olderThanHours(lastRun.started_at, 0.1);
  const lastFile = (lastRun?.input as { file_name?: string } | null)?.file_name;
  const mine = new Map((submissions ?? []).map((s) => [s.assignment_id, s]));
  const isStudent = me.role === "student";
  // One folded group per course; students get the courses with something left to do opened.
  const groups = Object.entries(Object.groupBy(assignments ?? [], (a) => a.course?.code ?? "Other")).map(([k, v]) => [k, v!] as const);

  return (
    <div className="max-w-3xl space-y-6">
      <AutoRefresh active={reading} />
      <h1 className="heading">Assignments</h1>
      {courses && courses.length > 0 && (
        <>
          {reading && <p className="card bg-ai/60 p-4 text-sm">The Assignment agent is reading {lastFile}…</p>}
          {lastRun?.status === "failed" && (
            <p role="alert" className="card bg-danger/30 p-4 text-sm">Couldn&apos;t draft from {lastFile}: {lastRun.error?.slice(0, 120)} Upload it again, or create the assignment by hand.</p>
          )}
          {(drafts ?? []).map((d) => <ApprovalCard key={d.id} a={d} inline />)}
          <Disclosure className="card p-4"
            title={<span className="section-title">New assignment</span>}
            meta={<AgentLabel name="Assignment agent" />}>
            <div className="space-y-4">
              <p className="text-sm muted">Upload the assignment PDF: the Assignment agent drafts the title, instructions, rubric and deadline. Students see nothing until you approve.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {courses.map((c) => (
                  <div key={c.id} className="space-y-1 text-sm">
                    <p className="font-bold"><span className="badge bg-info">{c.code}</span> {c.name}</p>
                    <FileUpload label="Upload assignment PDF" start={startBrief.bind(null, c.id)} finish={finishBrief.bind(null, c.id)} />
                  </div>
                ))}
              </div>
              <details>
                <summary className="cursor-pointer text-sm font-semibold underline decoration-2">Or create an assignment by hand</summary>
                <div className="mt-3"><CreateAssignmentForm courses={courses} /></div>
              </details>
            </div>
          </Disclosure>
        </>
      )}

      {groups.map(([code, list]) => {
        const todo = isStudent ? list.filter((a) => !mine.has(a.id)).length : 0;
        const subs = list.reduce((n, a) => n + (a.submissions?.[0]?.count ?? 0), 0);
        return (
          <Disclosure key={code} open={todo > 0} className="card p-4"
            title={<span className="section-title"><span className="badge bg-info">{code}</span> {list[0].course?.name}</span>}
            meta={<span className="text-xs muted">{plural(list.length, "assignment")} · {isStudent ? (todo ? `${todo} to do` : "all submitted ✓") : plural(subs, "submission")}</span>}>
            <ul className="space-y-2">
              {list.map((a) => {
                const sub = mine.get(a.id);
                return (
                  <li key={a.id}>
                    <Link href={`/assignments/${a.id}`} className="card-link flex flex-wrap items-center justify-between gap-2 p-3">
                      <div>
                        <p className="font-bold">{a.title}</p>
                        <p className="text-xs muted">due <LocalTime iso={a.due_at} /> ({relative(a.due_at)})</p>
                      </div>
                      {isStudent ? (
                        <StatusBadge submitted={!!sub} late={sub?.is_late} overdue={isPast(a.due_at)} />
                      ) : (
                        <span className="badge bg-white">{plural(a.submissions?.[0]?.count ?? 0, "submission")}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Disclosure>
        );
      })}
      {!assignments?.length && <p className="card p-4 text-sm muted">No assignments yet.</p>}
    </div>
  );
}
