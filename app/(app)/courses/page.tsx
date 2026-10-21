import Link from "next/link";
import { createClient, getMe } from "@/lib/supabase";
import { plural } from "@/lib/format";
import { LocalTime } from "@/components/local-time";

export default async function CoursesPage() {
  const me = await getMe();
  const db = await createClient();
  // RLS: students see enrolled courses, professors taught courses, admins all college courses.
  const { data: courses } = await db
    .from("courses")
    .select("id, code, name, term, professor:profiles(full_name), enrollments(count), assignments(id, title, due_at)")
    .order("code");

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{me.role === "professor" ? "My courses" : "Courses"}</h1>
      {(courses ?? []).map((c) => (
        <section key={c.id} className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">{c.code} — {c.name}</h2>
            <p className="text-xs text-gray-500">
              {c.professor?.full_name} · {c.term}
              {me.role !== "student" && ` · ${plural(c.enrollments?.[0]?.count ?? 0, "student")}`}
            </p>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
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
        </section>
      ))}
      {!courses?.length && <p className="text-sm text-gray-500">No courses.</p>}
    </div>
  );
}
