import "server-only";
import { z } from "zod";
import { runAgent, UNTRUSTED } from "./agent";
import { createServiceClient } from "./supabase";
import { readPages } from "./files";
import { money } from "./format";

// Each agent = instructions + output schema on the shared runtime. Facts are loaded here from the
// database (never supplied by the model), and anything consequential becomes an approval, not a write.

// ponytail: inputs are truncated to stay inside Groq free-tier token limits; raise with a paid tier.
const MAX_CHARS = 14_000;

const gradeScale: Record<string, string> = {
  cgpa10: "an indicative grade point out of 10 (CGPA scale), e.g. '7.5 / 10'",
  gpa4: "an indicative letter grade with 4.0-scale points, e.g. 'B+ (3.3)'",
  percentage: "an indicative percentage, e.g. '72%'",
};

// ───────── Submission agent: student submits → instant pre-check + feedback draft for the professor ─────────

export const precheckSchema = z.object({
  summary: z.string().describe("One sentence for the student, e.g. 'Covers 3 of 4 rubric items — normalization example missing.'"),
  items: z.array(z.object({
    rubric_item: z.string(),
    status: z.enum(["met", "partial", "missing"]),
    note: z.string().describe("What in the submission meets or misses this item"),
  })),
  feedback_draft: z.string().describe("Rubric-based feedback addressed to the student, 3-6 sentences, for the professor to review"),
  indicative_grade: z.string(),
});
export type Precheck = Pick<z.infer<typeof precheckSchema>, "summary" | "items">;

export async function submissionAgent(submissionId: string) {
  const db = createServiceClient();
  const { data: s } = await db
    .from("submissions")
    .select("id, institution_id, student_id, file_path, file_name, student:profiles(full_name), institution:institutions(grading_scale), assignment:assignments(id, title, instructions, rubric, course_id, course:courses(code))")
    .eq("id", submissionId)
    .single();
  if (!s?.assignment || !s.institution) return;
  await db.from("submissions").update({ precheck_status: "pending", precheck: null }).eq("id", s.id);

  let text: string;
  try {
    text = (await readPages("submissions", s.file_path)).join("\n\n").trim().slice(0, MAX_CHARS);
  } catch {
    text = "";
  }
  if (!text) {
    await db.from("submissions").update({
      precheck_status: "failed",
      precheck: { summary: "Couldn't read any text from this file (scanned PDF?). Your professor can still open it.", items: [] },
    }).eq("id", s.id);
    return;
  }

  const a = s.assignment;
  const rubric = a.rubric as string[];
  const res = await runAgent({
    agent: "submission",
    trigger: "event",
    institutionId: s.institution_id,
    userId: s.student_id,
    input: { submission_id: s.id, assignment_id: a.id, file_name: s.file_name },
    instructions: `You are the Submission agent at a college. Pre-check a student's submission against the assignment brief and rubric.
- Judge every rubric item, in order, as met / partial / missing, quoting or naming what you found.
- Only describe content that is actually in the submission. If something is absent, say it is missing.
- The grade you suggest is indicative only, for the professor; the professor decides the final grade.
- ${UNTRUSTED}`,
    prompt: `Assignment: ${a.title}
Instructions: ${a.instructions}
Rubric:
${rubric.map((r, i) => `${i + 1}. ${r}`).join("\n")}
Indicative grade format: ${gradeScale[s.institution.grading_scale]}

<submission file="${s.file_name}">
${text}
</submission>`,
    schema: precheckSchema,
  });

  if (!res.ok) {
    await db.from("submissions").update({ precheck_status: "failed" }).eq("id", s.id);
    return;
  }
  const { summary, items, feedback_draft, indicative_grade } = res.output;
  await db.from("submissions").update({ precheck_status: "done", precheck: { summary, items } }).eq("id", s.id);

  // A resubmission supersedes any earlier draft for the same submission.
  await db.from("approvals").update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("kind", "feedback_draft").eq("status", "pending").eq("payload->>submission_id", s.id);
  await db.from("approvals").insert({
    institution_id: s.institution_id, kind: "feedback_draft", reviewer_role: "professor", course_id: a.course_id, agent_run_id: res.runId,
    payload: {
      submission_id: s.id, assignment_id: a.id, assignment_title: a.title, course_code: a.course?.code ?? "", student_name: s.student?.full_name ?? "",
      file_name: s.file_name, summary, items, feedback: feedback_draft, indicative_grade,
    },
  });
}

// ───────── Materials agent: professor uploads notes → summary + announcement draft ─────────

const materialsSchema = z.object({
  summary: z.string().describe("3-5 sentence summary of what these notes cover"),
  key_topics: z.array(z.string()).max(6),
  announcement_title: z.string().describe("Short title, e.g. 'New material: Unit 3 – Normalization'"),
  announcement_body: z.string().describe("2-4 friendly sentences telling students what was uploaded and why it matters"),
});

export async function materialsAgent(documentId: string) {
  const db = createServiceClient();
  const { data: doc } = await db
    .from("documents")
    .select("id, institution_id, course_id, uploaded_by, title, page_count, course:courses(code, name)")
    .eq("id", documentId)
    .single();
  if (!doc) return;
  await db.from("documents").update({ summary_status: "pending" }).eq("id", doc.id);

  const { data: chunks } = await db.from("document_chunks").select("page, content").eq("document_id", doc.id).order("id");
  const text = (chunks ?? []).map((c) => `[p. ${c.page}] ${c.content}`).join("\n").slice(0, MAX_CHARS);

  const res = await runAgent({
    agent: "materials",
    trigger: "event",
    institutionId: doc.institution_id,
    userId: doc.uploaded_by,
    input: { document_id: doc.id, title: doc.title },
    instructions: `You are the Materials agent at a college. A professor uploaded course notes. Summarise them for students and draft a short "new material" announcement.
- Use only what is in the notes. Do not invent dates, deadlines or exam details.
- ${UNTRUSTED}`,
    prompt: `Course: ${doc.course ? `${doc.course.code} ${doc.course.name}` : "College-wide"}
File: ${doc.title} (${doc.page_count ?? "?"} pages)

<document>
${text}
</document>`,
    schema: materialsSchema,
  });

  if (!res.ok) {
    await db.from("documents").update({ summary_status: "failed" }).eq("id", doc.id);
    return;
  }
  const o = res.output;
  await db.from("documents").update({ summary: o.summary, summary_status: "done" }).eq("id", doc.id);
  await db.from("approvals").insert({
    institution_id: doc.institution_id, kind: "announcement", reviewer_role: doc.course_id ? "professor" : "admin", course_id: doc.course_id,
    agent_run_id: res.runId,
    payload: {
      document_id: doc.id, document_title: doc.title, course_code: doc.course?.code ?? "", summary: o.summary, key_topics: o.key_topics,
      title: o.announcement_title, body: o.announcement_body,
    },
  });
}

// ───────── Feedback agent: new rating → anonymous themes for the professor and admin ─────────

export const themesSchema = z.object({
  overview: z.string().describe("One or two sentences on overall sentiment"),
  themes: z.array(z.object({
    theme: z.string().describe("Short theme, e.g. 'Clear worked examples'"),
    sentiment: z.enum(["positive", "mixed", "negative"]),
    mentions: z.number().int().min(1),
  })).max(5),
});
export type Themes = z.infer<typeof themesSchema>;

// ponytail: runs on every new/edited rating; batch on a schedule if rating volume grows.
export async function feedbackAgent(courseId: string) {
  const db = createServiceClient();
  const { data: course } = await db.from("courses").select("id, institution_id, professor_id, code, name, term").eq("id", courseId).single();
  if (!course) return;
  const { data: ratings } = await db.from("professor_ratings").select("rating, comment").eq("course_id", course.id).eq("term", course.term);
  const comments = (ratings ?? []).filter((r) => r.comment?.trim());

  const save = (themes: Themes) =>
    db.from("rating_summaries").upsert({
      course_id: course.id, institution_id: course.institution_id, professor_id: course.professor_id,
      themes: JSON.stringify(themes), updated_at: new Date().toISOString(),
    });
  if (!comments.length) return save({ overview: "No written comments yet.", themes: [] });

  const res = await runAgent({
    agent: "feedback",
    trigger: "event",
    institutionId: course.institution_id,
    userId: course.professor_id,
    input: { course_id: course.id, ratings: ratings?.length ?? 0, comments: comments.length }, // no comment text in the log
    instructions: `You are the Feedback agent at a college. Group anonymous student comments about a course and its professor into 2-5 themes.
- Paraphrase. Never quote a comment word for word or include anything that could identify a student.
- Be constructive and specific; count how many comments support each theme.
- ${UNTRUSTED}`,
    prompt: `Course: ${course.code} ${course.name} (${course.term})

<document>
${comments.toSorted(() => Math.random() - 0.5).map((c) => `- (${c.rating}/5) ${c.comment}`).join("\n").slice(0, MAX_CHARS)}
</document>`,
    schema: themesSchema,
  });
  if (res.ok) await save(res.output);
}

// ───────── Planner agent: dashboard load (or "refresh") → ranked plan for the week ─────────

export const planSchema = z.object({
  summary: z.string().describe("One sentence overview of the week"),
  items: z.array(z.object({
    title: z.string().describe("What to do, e.g. 'Finish the CPU Scheduling Report'"),
    why: z.string().describe("Short reason grounded in the data: deadline, status, fee date, new notes"),
    link: z.string().describe("One of the provided links, exactly"),
    priority: z.enum(["high", "medium", "low"]),
  })).max(6),
});
export type Plan = z.infer<typeof planSchema>;

export async function plannerAgent(studentId: string) {
  const db = createServiceClient();
  const { data: me } = await db.from("profiles").select("institution_id, enrollments(course_id)").eq("id", studentId).single();
  if (!me) return;
  const courseIds = me.enrollments.map((e) => e.course_id);
  const now = new Date();
  const [{ data: assignments }, { data: fees }, { data: docs }, { data: inst }] = await Promise.all([
    db.from("assignments").select("id, title, due_at, course:courses(code), submissions(student_id, is_late)")
      .in("course_id", courseIds).gte("due_at", new Date(now.getTime() - 7 * 864e5).toISOString()).lte("due_at", new Date(now.getTime() + 14 * 864e5).toISOString()).order("due_at"),
    db.from("fee_records").select("description, amount_due, amount_paid, due_date").eq("student_id", studentId).neq("status", "paid"),
    db.from("documents").select("id, title, summary, created_at, course:courses(code)").in("course_id", courseIds).eq("status", "ready").order("created_at", { ascending: false }).limit(5),
    db.from("institutions").select("currency").eq("id", me.institution_id).single(),
  ]);

  const facts = {
    today: now.toISOString(),
    assignments: (assignments ?? []).map((a) => ({
      title: `${a.course?.code} ${a.title}`, due_at: a.due_at, link: `/assignments/${a.id}`,
      submitted: a.submissions.some((s) => s.student_id === studentId),
    })),
    fees: (fees ?? []).map((f) => ({ description: f.description, balance: money(f.amount_due - f.amount_paid, inst?.currency ?? "USD"), due_date: f.due_date, link: "/fees" })),
    new_materials: (docs ?? []).map((d) => ({ title: `${d.course?.code} ${d.title}`, summary: d.summary ?? "", link: `/files/document/${d.id}` })),
  };
  const allowed = new Set([...facts.assignments.map((a) => a.link), ...facts.fees.map((f) => f.link), ...facts.new_materials.map((m) => m.link)]);

  const res = await runAgent({
    agent: "planner",
    trigger: "event",
    institutionId: me.institution_id,
    userId: studentId,
    input: { date: now.toISOString().slice(0, 10), assignments: facts.assignments.length, fees: facts.fees.length },
    instructions: `You are the Planner agent. Build a short, prioritised plan for this student's week from the facts given.
- Use only the facts: never invent deadlines, amounts or assignments. Skip assignments already submitted.
- Rank by urgency: overdue or due soonest first, then fees due within 7 days, then reading new materials.
- Every item's link must be copied exactly from the facts.`,
    prompt: JSON.stringify(facts),
    schema: planSchema,
  });
  // Guardrail: drop any item whose link wasn't in the facts.
  if (res.ok) {
    const items = res.output.items.filter((i) => allowed.has(i.link));
    if (items.length !== res.output.items.length) {
      await db.from("agent_runs").update({ output: { ...res.output, items } }).eq("id", res.runId);
    }
  }
}
