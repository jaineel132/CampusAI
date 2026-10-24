import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServiceClient } from "@/lib/supabase";
import { ingestDocument } from "@/lib/ingest";
import { assignmentAgent, feedbackAgent, plannerAgent, submissionAgent } from "@/lib/agents";
import { runOpsDigest, runReminders } from "@/lib/jobs";
import { decideApproval } from "@/lib/approvals";
import { safeName } from "@/lib/format";

export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// ponytail: fixed pause between LLM calls to stay under Groq's free per-minute token limit; tune if the model or plan changes.
const PAUSE_MS = 12_000;

// Fills a freshly seeded demo with real agent output, so reviewers see every feature without doing any setup.
// Run after `npm run seed` (npm run demo does both). Bearer CRON_SECRET. Reads the sample files from demo/, so run it locally.
// Streams one line per finished step: the run takes several minutes, and a silent request would hit the 5-minute HTTP timeout.
export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const say = (line: string) => controller.enqueue(enc.encode(line + "\n"));
      try {
        say(JSON.stringify(await populate(say)));
      } catch (e) {
        say(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

async function populate(say: (line: string) => void) {
  const db = createServiceClient();
  const log: { step: string; ok: boolean }[] = [];
  const record = (step: string, ok: boolean) => {
    log.push({ step, ok });
    say(`${ok ? "✓" : "✗"} ${step}`);
  };

  // One LLM step: run it, check it produced its result, retry once after a longer pause (rate limits).
  async function step(name: string, run: () => Promise<unknown>, done: () => Promise<boolean>) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await run();
      if (await done()) return record(name, true);
      await sleep(30_000);
    }
    record(name, false);
  }

  const { data: colleges } = await db.from("institutions").select("id, slug").in("slug", ["northfield", "lakeside"]);
  const A = colleges?.find((c) => c.slug === "northfield")?.id;
  const B = colleges?.find((c) => c.slug === "lakeside")?.id;
  if (!A || !B) return { error: "Seed the demo first (npm run seed)." };

  const { data: people } = await db.from("profiles").select("id, email").in("institution_id", [A, B]);
  const user = (email: string) => people!.find((p) => p.email === email)!.id;
  const mehta = user("prof.mehta@northfield.demo"), aarav = user("aarav@northfield.demo"), diya = user("diya@northfield.demo");
  const admin = user("admin@northfield.demo"), jordan = user("jordan@lakeside.demo");

  const { data: courses } = await db.from("courses").select("id, code, term, professor_id").eq("institution_id", A);
  const dbms = courses!.find((c) => c.code === "CS301")!, os = courses!.find((c) => c.code === "CS302")!;
  const { data: assignments } = await db.from("assignments").select("id, title").eq("institution_id", A);
  const assignment = (title: string) => assignments!.find((a) => a.title === title)!.id;

  const demoFile = (name: string) => readFile(path.join(process.cwd(), "demo", name));
  const upload = async (bucket: "materials" | "submissions", key: string, file: string, contentType: string) => {
    const { error } = await db.storage.from(bucket).upload(key, await demoFile(file), { contentType });
    if (error) throw error;
  };

  // 1. Materials agent: professor uploads DBMS notes → indexed, summarised, announcement drafted → approved.
  const notes = "Unit 3 - Normalization.pdf";
  const notesPath = `${A}/${dbms.id}/${crypto.randomUUID()}-${safeName(notes)}`;
  await upload("materials", notesPath, notes, "application/pdf");
  const { data: doc } = await db.from("documents")
    .insert({ institution_id: A, course_id: dbms.id, uploaded_by: mehta, title: notes, file_path: notesPath }).select("id").single();
  await step("Materials agent: notes indexed and summarised", () => ingestDocument(doc!.id), async () =>
    (await db.from("documents").select("summary_status").eq("id", doc!.id).single()).data?.summary_status === "done");
  const { data: announcement } = await db.from("approvals").select("id").eq("kind", "announcement").eq("status", "pending").eq("payload->>document_id", doc!.id).maybeSingle();
  if (announcement) record("Professor approved the announcement", !(await decideApproval(db, announcement.id, mehta, "approved")));
  await sleep(PAUSE_MS);

  // 2. Assignment agent: professor uploads the assignment PDF → draft → approved (assignment created with the PDF).
  const brief = "Assignment 2 - SQL Joins.pdf";
  const briefPath = `${A}/${dbms.id}/briefs/${crypto.randomUUID()}-${safeName(brief)}`;
  await upload("materials", briefPath, brief, "application/pdf");
  const draft = () => db.from("approvals").select("id, payload").eq("kind", "assignment_draft").eq("status", "pending").eq("course_id", dbms.id).maybeSingle();
  await step("Assignment agent: assignment drafted from the PDF", async () => {
    const { data: run } = await db.from("agent_runs")
      .insert({ institution_id: A, agent: "assignment", trigger: "event", user_id: mehta, input: { course_id: dbms.id, file_name: brief } }).select("id").single();
    await assignmentAgent(run!.id, { institutionId: A, courseId: dbms.id, professorId: mehta, path: briefPath, fileName: brief });
  }, async () => !!(await draft()).data);
  const { data: briefDraft } = await draft();
  if (briefDraft) {
    const local = (briefDraft.payload as { due_local?: string | null }).due_local;
    // The PDF's deadline is local college time (IST); fall back to two weeks out if it had none.
    const due = local ? new Date(`${local}:00+05:30`) : new Date(Date.now() + 14 * 864e5);
    record("Professor approved the assignment", !(await decideApproval(db, briefDraft.id, mehta, "approved", { due_at: due.toISOString() })));
  }
  await sleep(PAUSE_MS);

  // 2b. Drafts left for the professor to approve: new OS notes (announcement draft) and a second assignment PDF.
  const osNotes = "Unit 2 - CPU Scheduling.pdf";
  const osNotesPath = `${A}/${os.id}/${crypto.randomUUID()}-${safeName(osNotes)}`;
  await upload("materials", osNotesPath, osNotes, "application/pdf");
  const { data: osDoc } = await db.from("documents")
    .insert({ institution_id: A, course_id: os.id, uploaded_by: mehta, title: osNotes, file_path: osNotesPath }).select("id").single();
  await step("Materials agent: OS notes summarised, announcement left to approve", () => ingestDocument(osDoc!.id), async () =>
    (await db.from("documents").select("summary_status").eq("id", osDoc!.id).single()).data?.summary_status === "done");
  await sleep(PAUSE_MS);

  const brief2 = "Assignment 3 - Transactions.pdf";
  const brief2Path = `${A}/${dbms.id}/briefs/${crypto.randomUUID()}-${safeName(brief2)}`;
  await upload("materials", brief2Path, brief2, "application/pdf");
  await step("Assignment agent: second assignment drafted, left to approve", async () => {
    const { data: run } = await db.from("agent_runs")
      .insert({ institution_id: A, agent: "assignment", trigger: "event", user_id: mehta, input: { course_id: dbms.id, file_name: brief2 } }).select("id").single();
    await assignmentAgent(run!.id, { institutionId: A, courseId: dbms.id, professorId: mehta, path: brief2Path, fileName: brief2 });
  }, async () => !!(await draft()).data);
  await sleep(PAUSE_MS);

  // 3. Submission agent: Aarav (good answer, feedback approved) and Diya (partial answer, feedback left for the professor).
  const submit = async (student: string, assignmentId: string, file: string) => {
    const key = `${A}/${assignmentId}/${student}/${crypto.randomUUID()}-${safeName(file)}`;
    await upload("submissions", key, `answers/${file}`, "text/plain");
    const { data } = await db.from("submissions").insert({
      institution_id: A, assignment_id: assignmentId, student_id: student, file_path: key, file_name: file, is_late: false, precheck_status: "pending",
    }).select("id").single();
    return data!.id;
  };
  const checked = (id: string) => async () => (await db.from("submissions").select("precheck_status").eq("id", id).single()).data?.precheck_status === "done";
  const aaravSub = await submit(aarav, assignment("Normalization Case Study"), "aarav-normalization.txt");
  await step("Submission agent: Aarav's pre-check + feedback draft", () => submissionAgent(aaravSub), checked(aaravSub));
  const { data: feedback } = await db.from("approvals").select("id").eq("kind", "feedback_draft").eq("status", "pending").eq("payload->>submission_id", aaravSub).maybeSingle();
  if (feedback) record("Professor approved Aarav's feedback", !(await decideApproval(db, feedback.id, mehta, "approved")));
  await sleep(PAUSE_MS);
  const diyaSub = await submit(diya, assignment("CPU Scheduling Report"), "diya-cpu-scheduling.txt");
  await step("Submission agent: Diya's pre-check (feedback left to approve)", () => submissionAgent(diyaSub), checked(diyaSub));
  await sleep(PAUSE_MS);

  // 4. Feedback agent: anonymous ratings → themes.
  await db.from("professor_ratings").insert([
    { institution_id: A, course_id: dbms.id, professor_id: mehta, student_id: aarav, term: dbms.term, rating: 4, comment: "Clear examples on normalization, but the pace is fast before tests." },
    { institution_id: A, course_id: os.id, professor_id: mehta, student_id: aarav, term: os.term, rating: 5, comment: "Great scheduling demos and helpful office hours." },
    { institution_id: A, course_id: os.id, professor_id: mehta, student_id: diya, term: os.term, rating: 3, comment: "Good content, but I'd like more practice problems." },
  ]);
  for (const c of [dbms, os]) {
    await step(`Feedback agent: themes for ${c.code}`, () => feedbackAgent(c.id), async () =>
      !!(await db.from("rating_summaries").select("course_id").eq("course_id", c.id).maybeSingle()).data);
    await sleep(PAUSE_MS);
  }

  // 5. Payment history: Aarav's library fee, recorded the same way the Stripe webhook records payments.
  const { data: library } = await db.from("fee_records").select("id").eq("student_id", aarav).eq("description", "Library fee").single();
  const { error: payError } = await db.rpc("record_payment", {
    p_fee_record_id: library!.id, p_amount: 2500, p_currency: "INR", p_session_id: `cs_test_seed_${Date.now()}`, p_receipt_url: "",
  });
  record("Payment recorded (library fee)", !payError);

  // 6. Reminder agent (rule-based) and Report agent for both colleges; their drafts stay pending for the admin.
  await runReminders();
  record("Reminder agent: reminders sent", true);
  for (const [college, label] of [[A, "Northfield"], [B, "Lakeside"]] as const) {
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      ok = (await runOpsDigest(college, "schedule", college === A ? admin : undefined)).ok;
      if (!ok) await sleep(30_000);
    }
    record(`Report agent: weekly report for ${label}`, ok);
    await sleep(PAUSE_MS);
  }

  // 7. Planner agent: a week plan for every student.
  for (const [student, name] of [[aarav, "Aarav"], [diya, "Diya"], [jordan, "Jordan"]] as const) {
    await step(`Planner agent: ${name}'s week plan`, () => plannerAgent(student), async () =>
      (await db.from("agent_runs").select("status").eq("agent", "planner").eq("user_id", student).order("started_at", { ascending: false }).limit(1).maybeSingle()).data?.status === "succeeded");
    await sleep(PAUSE_MS);
  }

  return { ok: log.every((l) => l.ok), steps: log };
}
