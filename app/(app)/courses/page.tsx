import Link from "next/link";
import { createClient, getMe } from "@/lib/supabase";
import { plural } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { FileUpload } from "@/components/file-upload";
import { AutoRefresh } from "@/components/auto-refresh";
import { AgentLabel } from "@/components/precheck";
import { ApprovalCard } from "@/components/approval";
import { SubmitButton } from "@/components/submit-button";
import { Disclosure } from "@/components/disclosure";
import { finishMaterial, retryMaterial, retrySummary, startMaterial } from "./actions";

const docStatus: Record<string, string> = {
  uploaded: "bg-white",
  processing: "bg-yellow",
  ready: "bg-mint",
  failed: "bg-danger",
};

export default async function CoursesPage() {
  const me = await getMe();
  const db = await createClient();
  // RLS: students see enrolled courses, professors taught courses, admins all college courses.
  const { data: courses } = await db
    .from("courses")
    .select(
      "id, code, name, term, professor_id, professor:profiles(full_name), enrollments(count), assignments(id, title, due_at), documents(id, title, status, error, page_count, created_at, summary, summary_status)"
    )
    .order("code");
  // RLS: only the reviewer sees pending drafts, so students get none.
  const { data: drafts } = await db.from("approvals").select("id, kind, payload, created_at").eq("kind", "announcement").eq("status", "pending");
  const draftFor = new Map((drafts ?? []).map((a) => [(a.payload as { document_id?: string }).document_id, a]));

  const isStudent = me.role === "student";
  const processing = (courses ?? []).some((c) =>
    c.documents.some((d) => d.status === "uploaded" || d.status === "processing" || (d.status === "ready" && d.summary_status === "pending"))
  );

  return (
    <div className="max-w-3xl space-y-4">
      <AutoRefresh active={processing} />
      <h1 className="heading">{me.role === "professor" ? "My courses & uploads" : "Courses & materials"}</h1>
      <p className="text-sm muted">Open a course to see its materials and assignments.</p>
      {(courses ?? []).map((c) => {
        // Students only see materials that finished processing.
        const docs = c.documents.filter((d) => !isStudent || d.status === "ready").toSorted((x, y) => y.created_at.localeCompare(x.created_at));
        // Open whatever needs the professor's attention: something processing, failed, or a draft to approve.
        const needsLook = (d: (typeof docs)[number]) => !isStudent && (d.status !== "ready" || d.summary_status !== "done" || draftFor.has(d.id));
        const busy = docs.some(needsLook);
        const assignments = c.assignments.toSorted((x, y) => x.due_at.localeCompare(y.due_at));
        return (
          <Disclosure key={c.id} open={busy} className="card p-4"
            title={<span className="section-title"><span className="badge bg-sky">{c.code}</span> {c.name}</span>}
            meta={<span className="text-xs muted">
              {c.professor?.full_name} · {plural(docs.length, "material")} · {plural(assignments.length, "assignment")}
              {!isStudent && ` · ${plural(c.enrollments?.[0]?.count ?? 0, "student")}`}
            </span>}>
            <div className="space-y-3 border-t-2 border-ink pt-3">
              <Disclosure open={busy} className="rounded-md border-2 border-ink bg-cream p-3"
                title={<span className="font-bold">📚 Materials</span>} meta={<span className="badge bg-white">{docs.length}</span>}>
                <ul className="space-y-2 text-sm">
                  {docs.map((d) => (
                    <li key={d.id}>
                      <Disclosure open={needsLook(d)} className="rounded-md border-2 border-ink bg-white p-2"
                        title={<span className="font-semibold">📄 {d.title}</span>}
                        meta={<span className="flex items-center gap-2 text-xs muted">
                          {d.page_count && plural(d.page_count, "page")}
                          {!isStudent && <span className={`badge capitalize ${docStatus[d.status]}`}>{d.status}</span>}
                        </span>}>
                        <div className="space-y-2">
                          <a href={`/files/document/${d.id}`} target="_blank" className="btn-ghost btn-sm">Open PDF ↗</a>
                          {d.summary && <p className="text-ink/85"><AgentLabel name="Materials agent" /> {d.summary}</p>}
                          {!isStudent && d.status === "failed" && (
                            <form action={retryMaterial.bind(null, d.id)} className="text-xs text-danger-ink">
                              {d.error} <SubmitButton pending="Retrying…" className="btn-ghost btn-sm ml-1">Retry</SubmitButton>
                            </form>
                          )}
                          {!isStudent && d.status === "ready" && d.summary_status === "pending" && <p className="text-xs muted">Writing summary and announcement draft…</p>}
                          {!isStudent && d.summary_status === "failed" && (
                            <form action={retrySummary.bind(null, d.id)} className="text-xs text-danger-ink">
                              Summary failed (AI unavailable). <SubmitButton pending="Retrying…" className="btn-ghost btn-sm ml-1">Retry</SubmitButton>
                            </form>
                          )}
                          {draftFor.has(d.id) && <ApprovalCard a={draftFor.get(d.id)!} inline />}
                        </div>
                      </Disclosure>
                    </li>
                  ))}
                  {!docs.length && <li className="muted">No materials yet.</li>}
                </ul>
                {c.professor_id === me.id && (
                  <div className="mt-3">
                    <FileUpload label="Upload notes (PDF/TXT)" start={startMaterial.bind(null, c.id)} finish={finishMaterial.bind(null, c.id)} />
                  </div>
                )}
              </Disclosure>

              <Disclosure className="rounded-md border-2 border-ink bg-cream p-3"
                title={<span className="font-bold">📝 Assignments</span>} meta={<span className="badge bg-white">{assignments.length}</span>}>
                <ul className="space-y-2 text-sm">
                  {assignments.map((a) => (
                    <li key={a.id}>
                      <Link href={`/assignments/${a.id}`} className="card-link flex flex-wrap items-center justify-between gap-2 p-2">
                        <span className="font-semibold">{a.title}</span>
                        <span className="text-xs muted">due <LocalTime iso={a.due_at} /></span>
                      </Link>
                    </li>
                  ))}
                  {!assignments.length && <li className="muted">No assignments yet.</li>}
                </ul>
              </Disclosure>
            </div>
          </Disclosure>
        );
      })}
      {!courses?.length && <p className="text-sm text-ink/70">No courses.</p>}
    </div>
  );
}
