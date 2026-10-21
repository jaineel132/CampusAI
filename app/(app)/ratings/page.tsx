import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, getMe } from "@/lib/supabase";
import { feedbackAgent, type Themes } from "@/lib/agents";
import { AgentLabel } from "@/components/precheck";
import { olderThanHours, plural } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { Disclosure } from "@/components/disclosure";

const tone = { positive: "bg-mint", mixed: "bg-yellow", negative: "bg-danger" } as const;

// One rating per student per course per term; saving again edits it (unique constraint + upsert).
async function rate(courseId: string, form: FormData) {
  "use server";
  const me = await getMe();
  const rating = Number(form.get("rating"));
  if (me.role !== "student" || !Number.isInteger(rating) || rating < 1 || rating > 5) return;
  const comment = String(form.get("comment") ?? "").trim().slice(0, 1000) || null;

  const db = await createClient();
  const { data: course } = await db.from("courses").select("id, professor_id, term").eq("id", courseId).maybeSingle(); // RLS: enrolled only
  if (!course) return;
  // RLS also checks enrollment and that professor_id matches the course.
  const { error } = await db.from("professor_ratings").upsert(
    { institution_id: me.institution.id, course_id: course.id, professor_id: course.professor_id, student_id: me.id, term: course.term, rating, comment, updated_at: new Date().toISOString() },
    { onConflict: "student_id,course_id,term" }
  );
  if (error) return;
  after(() => feedbackAgent(course.id));
  revalidatePath("/ratings");
}

export default async function RatingsPage() {
  const me = await getMe();
  return me.role === "student" ? <StudentRatings /> : <RatingThemes />;
}

async function StudentRatings() {
  const db = await createClient();
  const [{ data: courses }, { data: mine }] = await Promise.all([
    db.from("courses").select("id, code, name, term, professor:profiles(full_name)").order("code"),
    db.from("professor_ratings").select("course_id, term, rating, comment, updated_at"), // RLS: only my own rows
  ]);
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="heading">Rate professors</h1>
        <p className="text-sm text-ink/70">Anonymous: professors only see the average, the count and themes, never who wrote what.</p>
      </div>
      {(courses ?? []).map((c) => {
        const r = mine?.find((m) => m.course_id === c.id && m.term === c.term);
        const justSaved = !!r && !olderThanHours(r.updated_at, 1 / 60);
        // Unrated courses stay open (something to do); rated ones fold to "You rated 4★".
        return (
          <Disclosure key={c.id} open={!r || justSaved} className="card p-4"
            title={<h2 className="section-title"><span className="badge bg-sky">{c.code}</span> {c.professor?.full_name}</h2>}
            meta={<span className="text-xs">
              {r ? <span className="badge bg-yellow">You rated {r.rating}★</span> : <span className="badge bg-white">Not rated yet</span>}
              {justSaved && <span className="ml-2 font-bold text-ok-ink">✓ Saved</span>}
            </span>}>
          <form action={rate.bind(null, c.id)} className="space-y-3">
            <p className="text-xs muted">{c.term}</p>
            <fieldset className="flex gap-2" aria-label={`Rating for ${c.code}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input type="radio" name="rating" value={n} required defaultChecked={r?.rating === n} className="peer sr-only" />
                  <span className="block rounded-md border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold shadow-brutal-sm transition-transform hover:-translate-y-px peer-checked:translate-x-0.5 peer-checked:translate-y-0.5 peer-checked:bg-yellow peer-checked:shadow-none peer-focus-visible:ring-4 peer-focus-visible:ring-sky">
                    {n}★
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="block text-sm">
              Comment (optional)
              <textarea name="comment" rows={2} defaultValue={r?.comment ?? ""} maxLength={1000} className="mt-1 field" />
            </label>
            <SubmitButton pending="Saving…">{r ? "Update rating" : "Submit rating"}</SubmitButton>
          </form>
          </Disclosure>
        );
      })}
    </div>
  );
}

async function RatingThemes() {
  const db = await createClient();
  // Professors: their courses; admins: the whole college. Raw ratings are never queried here.
  const [{ data: courses }, { data: aggregates }, { data: summaries }] = await Promise.all([
    db.from("courses").select("id, code, name, term, professor:profiles(full_name)").order("code"),
    db.from("rating_aggregates").select("course_id, average, count"),
    db.from("rating_summaries").select("course_id, themes, updated_at"),
  ]);
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="heading">Ratings & themes</h1>
        <p className="text-sm text-ink/70">Anonymous averages and themes. Individual ratings and names are never shown.</p>
      </div>
      {(courses ?? []).map((c) => {
        const agg = aggregates?.find((a) => a.course_id === c.id);
        const sum = summaries?.find((s) => s.course_id === c.id);
        const themes = sum ? (JSON.parse(sum.themes) as Themes) : null;
        return (
          <section key={c.id} className="space-y-2 card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="section-title"><span className="badge bg-sky">{c.code}</span> {c.name} <span className="text-sm font-normal text-ink/70">· {c.professor?.full_name}</span></h2>
              {agg ? (
                <span className="rounded-md border-2 border-ink bg-yellow px-3 py-1 text-right shadow-brutal-sm">
                  <span className="text-xl font-bold">{agg.average}</span> / 5
                  <span className="block text-xs">{plural(agg.count ?? 0, "rating")}</span>
                </span>
              ) : <span className="text-sm muted">No ratings yet</span>}
            </div>
            {themes && (
              <div className="space-y-2 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-ink/85"><AgentLabel name="Feedback agent" /> {themes.overview}</p>
                <ul className="flex flex-wrap gap-2">
                  {themes.themes.map((t) => (
                    <li key={t.theme} className={`badge ${tone[t.sentiment]}`}>{t.theme} · {t.mentions}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
