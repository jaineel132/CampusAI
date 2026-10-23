import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getMe } from "@/lib/supabase";
import { LocalTime } from "@/components/local-time";
import { SubmitButton } from "@/components/submit-button";

const field = "mt-1 field";

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
      <h1 className="heading">Announcements</h1>

      <form action={post} className="space-y-3 card p-5">
        <h2 className="section-title">{me.role === "admin" ? "Post to the whole college" : "Post to a course"}</h2>
        {courses && (
          <label className="block text-sm">Course
            <select name="course_id" required className={field}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </label>
        )}
        <label className="block text-sm">Title<input name="title" required className={field} /></label>
        <label className="block text-sm">Message<textarea name="body" required rows={3} className={field} /></label>
        <SubmitButton pending="Publishing…">Publish</SubmitButton>
      </form>

      <ul className="space-y-3">
        {(list ?? []).map((a) => (
          <li key={a.id} className="card space-y-1 p-4 text-sm">
            <p className="font-bold"><span className={`badge ${a.course?.code ? "bg-info" : "bg-ok"}`}>{a.course?.code ?? "College"}</span> {a.title}</p>
            <p className="text-ink/85">{a.body}</p>
            <p className="text-xs text-ink/60">
              {a.author?.full_name} · <LocalTime iso={a.published_at} />{a.approval_id && <> · <span className="sticker">✦ drafted by agent, approved</span></>}
            </p>
          </li>
        ))}
        {!list?.length && <li className="card p-4 text-sm text-ink/70">No announcements yet.</li>}
      </ul>
    </div>
  );
}
