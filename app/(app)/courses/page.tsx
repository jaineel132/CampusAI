import Link from "next/link";
import { createClient, getMe } from "@/lib/supabase";
import { plural } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { FileUpload } from "@/components/file-upload";
import { AutoRefresh } from "@/components/auto-refresh";
import { AgentLabel } from "@/components/precheck";
import { finishMaterial, retryMaterial, retrySummary, startMaterial } from "./actions";

const docStatus: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-700",
  processing: "bg-amber-100 text-amber-800",
  ready: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
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

  const isStudent = me.role === "student";
  const processing = (courses ?? []).some((c) =>
    c.documents.some((d) => d.status === "uploaded" || d.status === "processing" || (d.status === "ready" && d.summary_status === "pending"))
  );

  return (
    <div className="max-w-3xl space-y-4">
      <AutoRefresh active={processing} />
      <h1 className="text-xl font-semibold">{me.role === "professor" ? "My courses & uploads" : "Courses & materials"}</h1>
      {(courses ?? []).map((c) => {
        // Students only see materials that finished processing.
        const docs = c.documents.filter((d) => !isStudent || d.status === "ready").toSorted((x, y) => y.created_at.localeCompare(x.created_at));
        return (
          <section key={c.id} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">{c.code} — {c.name}</h2>
              <p className="text-xs text-gray-500">
                {c.professor?.full_name} · {c.term}
                {!isStudent && ` · ${plural(c.enrollments?.[0]?.count ?? 0, "student")}`}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium">Materials</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {docs.map((d) => (
                  <li key={d.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={`/files/document/${d.id}`} target="_blank" className="underline">{d.title}</a>
                      {d.page_count && <span className="text-gray-500">· {plural(d.page_count, "page")}</span>}
                      {!isStudent && <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${docStatus[d.status]}`}>{d.status}</span>}
                      {!isStudent && d.status === "failed" && (
                        <>
                          <span className="text-xs text-red-600">{d.error}</span>
                          <form action={retryMaterial.bind(null, d.id)}><button className="text-xs underline">Retry</button></form>
                        </>
                      )}
                    </div>
                    {d.summary && (
                      <p className="text-gray-600"><AgentLabel name="Materials agent" /> {d.summary}</p>
                    )}
                    {!isStudent && d.status === "ready" && d.summary_status === "pending" && <p className="text-xs text-gray-500">Writing summary and announcement draft…</p>}
                    {!isStudent && d.summary_status === "failed" && (
                      <form action={retrySummary.bind(null, d.id)} className="text-xs text-red-600">
                        Summary failed (AI unavailable). <button className="underline">Retry</button>
                      </form>
                    )}
                  </li>
                ))}
                {!docs.length && <li className="text-gray-500">No materials yet.</li>}
              </ul>
              {c.professor_id === me.id && (
                <div className="mt-3">
                  <FileUpload label="Upload notes (PDF/TXT)" start={startMaterial.bind(null, c.id)} finish={finishMaterial.bind(null, c.id)} />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium">Assignments</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {c.assignments
                  .toSorted((x, y) => x.due_at.localeCompare(y.due_at))
                  .map((a) => (
                    <li key={a.id}>
                      <Link href={`/assignments/${a.id}`} className="underline">{a.title}</Link>
                      <span className="text-gray-500"> · due <LocalTime iso={a.due_at} /></span>
                    </li>
                  ))}
                {!c.assignments.length && <li className="text-gray-500">No assignments yet.</li>}
              </ul>
            </div>
          </section>
        );
      })}
      {!courses?.length && <p className="text-sm text-gray-500">No courses.</p>}
    </div>
  );
}
