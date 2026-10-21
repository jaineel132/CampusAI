import { notFound } from "next/navigation";
import { createClient, getMe } from "@/lib/supabase";
import { relative } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { FileUpload } from "@/components/file-upload";
import { AutoRefresh } from "@/components/auto-refresh";
import { PrecheckCard } from "@/components/precheck";
import type { Precheck } from "@/lib/agents";
import { finishSubmission, retryPrecheck, startSubmission } from "../actions";

export default async function AssignmentPage(props: PageProps<"/assignments/[id]">) {
  const { id } = await props.params;
  const me = await getMe();
  const db = await createClient();
  const { data: a } = await db
    .from("assignments")
    .select("id, title, instructions, rubric, due_at, course:courses(code, name)")
    .eq("id", id)
    .maybeSingle();
  if (!a) notFound(); // not visible under RLS = doesn't exist for this user

  // RLS: a student gets only their own row; a professor gets every submission for their course.
  const { data: submissions } = await db
    .from("submissions")
    .select("id, file_name, submitted_at, is_late, precheck, precheck_status, feedback, feedback_released_at, student:profiles(full_name)")
    .eq("assignment_id", a.id)
    .order("submitted_at", { ascending: false });
  const mine = me.role === "student" ? submissions?.[0] : undefined;
  const pending = (submissions ?? []).some((s) => s.precheck_status === "pending");

  return (
    <div className="max-w-3xl space-y-6">
      <AutoRefresh active={pending} />
      <div>
        <p className="text-sm text-gray-500">{a.course?.code} · {a.course?.name}</p>
        <h1 className="text-xl font-semibold">{a.title}</h1>
        <p className="text-sm text-gray-600">Due <LocalTime iso={a.due_at} /> ({relative(a.due_at)})</p>
      </div>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
        <p className="whitespace-pre-line text-sm">{a.instructions}</p>
        <div>
          <h2 className="text-sm font-medium">Rubric</h2>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {(a.rubric as string[]).map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      </section>

      {me.role === "student" && (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-medium">Your submission</h2>
          {mine ? (
            <p className="text-sm">
              ✓ <a href={`/files/submission/${mine.id}`} target="_blank" className="underline">{mine.file_name}</a>
              {" saved "}<LocalTime iso={mine.submitted_at} />
              {mine.is_late && <span className="text-red-600"> (late)</span>}
            </p>
          ) : (
            <p className="text-sm text-gray-500">Nothing submitted yet. PDF or TXT, up to 10 MB.</p>
          )}
          {mine && (
            <PrecheckCard status={mine.precheck_status} precheck={mine.precheck as Precheck | null} retry={retryPrecheck.bind(null, mine.id)} />
          )}
          {mine?.feedback_released_at && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
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
        <section className="rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-200 p-4 font-medium">Submissions ({submissions?.length ?? 0})</h2>
          <ul className="divide-y divide-gray-200">
            {(submissions ?? []).map((s) => (
              <li key={s.id} className="space-y-1 p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{s.student?.full_name}</span>
                  <span className="text-gray-600">
                    <a href={`/files/submission/${s.id}`} target="_blank" className="underline">{s.file_name}</a>
                    {" · "}<LocalTime iso={s.submitted_at} />
                    {s.is_late && <span className="text-red-600"> · late</span>}
                  </span>
                </div>
                <p className="text-gray-600">
                  Pre-check: {s.precheck_status === "done" ? (s.precheck as Precheck | null)?.summary : s.precheck_status}
                  {" · "}
                  {s.feedback_released_at ? "feedback sent" : <a href="/inbox" className="underline">feedback draft in inbox</a>}
                </p>
              </li>
            ))}
            {!submissions?.length && <li className="p-4 text-sm text-gray-500">No submissions yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
