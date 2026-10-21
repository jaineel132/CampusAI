import Link from "next/link";
import { createClient, getMe } from "@/lib/supabase";
import { isPast, plural, relative } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";
import { CreateAssignmentForm } from "./create-form";

export default async function AssignmentsPage() {
  const me = await getMe();
  const db = await createClient();
  // RLS limits rows: students see enrolled courses, professors their own, admins the college.
  const [{ data: assignments }, { data: submissions }, { data: courses }] = await Promise.all([
    db.from("assignments").select("id, title, due_at, course:courses(code), submissions(count)").order("due_at"),
    db.from("submissions").select("assignment_id, is_late").eq("student_id", me.id),
    me.role === "professor" ? db.from("courses").select("id, code, name").eq("professor_id", me.id) : Promise.resolve({ data: null }),
  ]);
  const mine = new Map((submissions ?? []).map((s) => [s.assignment_id, s]));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Assignments</h1>
      {courses && courses.length > 0 && <CreateAssignmentForm courses={courses} />}

      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {(assignments ?? []).map((a) => {
          const sub = mine.get(a.id);
          return (
            <li key={a.id}>
              <Link href={`/assignments/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-gray-50">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-gray-500">
                    {a.course?.code} · due <LocalTime iso={a.due_at} /> ({relative(a.due_at)})
                  </p>
                </div>
                {me.role === "student" ? (
                  <StatusBadge submitted={!!sub} late={sub?.is_late} overdue={isPast(a.due_at)} />
                ) : (
                  <span className="text-sm text-gray-600">{plural(a.submissions?.[0]?.count ?? 0, "submission")}</span>
                )}
              </Link>
            </li>
          );
        })}
        {!assignments?.length && <li className="p-4 text-sm text-gray-500">No assignments yet.</li>}
      </ul>
    </div>
  );
}
