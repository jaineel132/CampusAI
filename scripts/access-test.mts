// Proves RLS isolation: students only see their own records, colleges never see each other.
// Run after seeding: npm run test:access
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function as(email: string) {
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email, password: "Kibo-demo-2026" });
  if (error) throw error;
  return db;
}

const rows = async (db: Awaited<ReturnType<typeof as>>, table: string) => {
  const { data, error } = await db.from(table).select("*");
  if (error) throw error;
  return data;
};

const aarav = await as("aarav@northfield.demo");
const diya = await as("diya@northfield.demo");
const jordan = await as("jordan@lakeside.demo");
const mehta = await as("prof.mehta@northfield.demo");
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const aaravId = (await aarav.auth.getUser()).data.user!.id;
const aaravCourses = await (async () => { const { data } = await aarav.from("courses").select("id, code"); return data ?? []; })();

// Student B (Diya) cannot see Student A's (Aarav's) fees or submissions
const diyaFees = await rows(diya, "fee_records");
assert.ok(diyaFees.length > 0, "Diya sees her own fees");
assert.ok(diyaFees.every((f) => f.student_id !== aaravId), "Diya must not see Aarav's fees");

// Diya is not in DBMS: no DBMS course, assignments
const diyaCourses = await rows(diya, "courses");
assert.deepEqual(diyaCourses.map((c) => c.code), ["CS302"], "Diya only sees OS");

// College B student sees nothing from college A
const jordanCourses = await rows(jordan, "courses");
assert.deepEqual(jordanCourses.map((c) => c.code), ["CS110"], "Jordan only sees his college's course");
assert.equal((await rows(jordan, "institutions")).length, 1, "Jordan sees only his college");
assert.ok((await rows(jordan, "profiles")).every((p) => !p.email.endsWith("@northfield.demo")), "no cross-college profiles");
assert.ok((await rows(jordan, "announcements")).length === 0, "no college A announcements for Jordan");

// Professor sees only their courses' data and no raw ratings
assert.ok((await rows(mehta, "fee_records")).length === 0, "professor sees no fees");
assert.ok((await rows(mehta, "professor_ratings")).length === 0, "professor sees no raw ratings");

// Logged-out visitor sees nothing
for (const t of ["institutions", "profiles", "courses", "fee_records"]) assert.equal((await rows(anon, t)).length, 0, `anon sees no ${t}`);

// Students cannot write their own payment state
const { error: feeWrite } = await aarav.from("fee_records").update({ amount_paid: 999999 }).eq("student_id", aaravId).select();
const fees = await rows(aarav, "fee_records");
assert.ok(feeWrite || fees.every((f) => f.amount_paid < 999999), "student cannot mark fees paid");

console.log("✓ record access passed");

// RAG scope: DBMS notes are searchable by Aarav (enrolled) but never by Diya (OS only) or Jordan (other college).
const embedRes = await fetch(`${url}/functions/v1/embed`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
  body: JSON.stringify({ input: ["third normal form transitive dependency"] }),
});
const [vector] = (await embedRes.json()).embeddings;
const search = async (db: Awaited<ReturnType<typeof as>>) => {
  const { data, error } = await db.rpc("match_chunks", { query_embedding: JSON.stringify(vector), match_count: 5 });
  if (error) throw error;
  return data as { document_id: string }[];
};
const { data: dbmsDocs } = await aarav.from("documents").select("id, course:courses!inner(code)").eq("course.code", "CS301");
const dbmsIds = new Set((dbmsDocs ?? []).map((d) => d.id));
const fromDbms = (hits: { document_id: string }[]) => hits.filter((h) => dbmsIds.has(h.document_id)).length;
const aaravHits = fromDbms(await search(aarav));
if (aaravHits) {
  assert.equal(fromDbms(await search(diya)), 0, "Diya gets no DBMS passages");
  assert.equal((await search(jordan)).length, 0, "Jordan gets no college A passages at all");
  console.log(`✓ RAG scope passed (Aarav: ${aaravHits} DBMS passages, Diya: 0, Jordan: 0)`);
} else {
  console.log("· RAG scope skipped: upload a DBMS document first");
}

// Announcements reach only their audience: course posts never reach students outside the course or college.
const courseAnns = (await rows(aarav, "announcements")).filter((a) => a.course_id);
if (courseAnns.length) {
  const ids = new Set(courseAnns.filter((a) => a.course_id === aaravCourses.find((c) => c.code === "CS301")?.id).map((a) => a.id));
  assert.ok((await rows(diya, "announcements")).every((a) => !ids.has(a.id)), "Diya sees no DBMS announcements");
  assert.equal((await rows(jordan, "announcements")).length, 0, "Jordan sees no college A announcements");
  console.log(`✓ announcement audience passed (${ids.size} DBMS announcement(s) hidden from Diya and Jordan)`);
}

// Approvals and agent runs stay with their reviewers
assert.equal((await rows(aarav, "approvals")).length, 0, "students never see the approval inbox");
assert.ok((await rows(diya, "agent_runs")).every((r) => r.user_id !== aaravId), "no one sees another student's agent runs");
console.log("✓ approvals + agent runs scoped");

// Ratings: one per student per course per term, only for enrolled courses, never readable by professors.
const dbms = aaravCourses.find((c) => c.code === "CS301")!;
const { data: dbmsCourse } = await aarav.from("courses").select("professor_id, term").eq("id", dbms.id).single();
const rating = { institution_id: (await rows(aarav, "institutions"))[0].id, course_id: dbms.id, professor_id: dbmsCourse!.professor_id, term: dbmsCourse!.term, rating: 5 };
const diyaId = (await diya.auth.getUser()).data.user!.id;
const { error: notEnrolled } = await diya.from("professor_ratings").insert({ ...rating, student_id: diyaId });
assert.ok(notEnrolled, "Diya cannot rate DBMS (not enrolled)");
await aarav.from("professor_ratings").upsert({ ...rating, student_id: aaravId }, { onConflict: "student_id,course_id,term" });
const { error: duplicate } = await aarav.from("professor_ratings").insert({ ...rating, student_id: aaravId });
assert.ok(duplicate, "second rating for the same course + term is rejected");
assert.equal((await rows(mehta, "professor_ratings")).length, 0, "professor still sees no raw ratings");
const { data: agg } = await mehta.from("rating_aggregates").select("*");
assert.ok(agg?.length && !("student_id" in agg[0]), "professor sees only anonymous aggregates");
console.log("✓ ratings rules passed");

// Assignment briefs: an assignment can only point at a PDF in its own course's briefs folder.
const os = aaravCourses.find((c) => c.code === "CS302")!;
const { error: foreignBrief } = await mehta.from("assignments").insert({
  institution_id: rating.institution_id, course_id: os.id, title: "x", instructions: "x", due_at: new Date(Date.now() + 864e5).toISOString(),
  created_by: dbmsCourse!.professor_id, file_path: `${rating.institution_id}/${dbms.id}/briefs/other.pdf`,
});
assert.ok(foreignBrief, "an assignment cannot attach another course's file");
console.log("✓ assignment brief paths scoped");

// Leave demo data as it was: remove the test rating (no student delete policy exists, so use the service role).
await createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  .from("professor_ratings").delete().eq("student_id", aaravId).eq("course_id", dbms.id).eq("rating", 5).is("comment", null);
