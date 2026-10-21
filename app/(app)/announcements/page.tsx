import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getMe } from "@/lib/supabase";
import { LocalTime } from "@/components/local-time";

const field = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

// Manual posting. RLS: professors only to courses they teach, admins only college-wide.
async function post(form: FormData) {
  "use server";
  const me = await getMe();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const course = String(form.get("course_id") ?? "");
  if (!title || !body) return;
  const db = await createClient();
  await db.from("announcements").insert({
    institution_id: me.institution.id, author_id: me.id, title, body, course_id: me.role === "admin" ? null : course,
  });
  revalidatePath("/announcements");
}

export default async function AnnouncementsPage() {
  const me = await getMe();
  if (me.role === "student") redirect("/dashboard");
  const db = await createClient();
  const [{ data: list }, { data: courses }] = await Promise.all([
    db.from("announcements").select("id, title, body, published_at, approval_id, course:courses(code), author:profiles(full_name)").order("published_at", { ascending: false }).limit(30),
    me.role === "professor" ? db.from("courses").select("id, code, name").eq("professor_id", me.id) : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Announcements</h1>

      <form action={post} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-medium">{me.role === "admin" ? "Post to the whole college" : "Post to a course"}</h2>
        {courses && (
          <label className="block text-sm">Course
            <select name="course_id" required className={field}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </label>
        )}
        <label className="block text-sm">Title<input name="title" required className={field} /></label>
        <label className="block text-sm">Message<textarea name="body" required rows={3} className={field} /></label>
        <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">Publish</button>
      </form>

      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {(list ?? []).map((a) => (
          <li key={a.id} className="p-4 text-sm">
            <p className="font-medium">{a.course?.code ?? "College"} · {a.title}</p>
            <p className="text-gray-700">{a.body}</p>
            <p className="text-xs text-gray-400">
              {a.author?.full_name} · <LocalTime iso={a.published_at} />{a.approval_id && " · drafted by agent, approved"}
            </p>
          </li>
        ))}
        {!list?.length && <li className="p-4 text-sm text-gray-500">No announcements yet.</li>}
      </ul>
    </div>
  );
}
