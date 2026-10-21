import "server-only";
import { z } from "zod";
import { createServiceClient } from "./supabase";
import { runAgent } from "./agent";
import { money } from "./format";
import type { Json } from "./database.types";
import type { Themes } from "./agents";

const DAY = 864e5;
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * DAY);

// ───────── Reminder agent (daily, rule-based: no LLM, so it can never invent a deadline) ─────────

export async function runReminders() {
  const db = createServiceClient();
  const { data: colleges } = await db.from("institutions").select("id, currency");
  const results = [];

  for (const inst of colleges ?? []) {
    const { data: run } = await db.from("agent_runs").insert({ institution_id: inst.id, agent: "reminder", trigger: "schedule", input: { date: today() } }).select("id").single();
    try {
      // Assignments due in the next 48 h without a submission, per enrolled student.
      const { data: due } = await db
        .from("assignments")
        .select("id, title, due_at, course:courses(code, enrollments(student_id)), submissions(student_id)")
        .eq("institution_id", inst.id)
        .gt("due_at", new Date().toISOString())
        .lte("due_at", inDays(2).toISOString());
      const assignmentReminders = (due ?? []).flatMap((a) => {
        const submitted = new Set(a.submissions.map((s) => s.student_id));
        const hours = Math.round((new Date(a.due_at).getTime() - Date.now()) / 36e5);
        return (a.course?.enrollments ?? [])
          .filter((e) => !submitted.has(e.student_id))
          .map((e) => ({
            user_id: e.student_id, kind: "reminder", link: `/assignments/${a.id}`, ref: `due:${a.id}:${today()}`,
            title: `Reminder: ${a.course?.code} ${a.title} due in ${hours} h`, body: "You haven't submitted yet.",
          }));
      });

      // Unpaid fees due within 7 days (or already overdue).
      const { data: fees } = await db
        .from("fee_records")
        .select("id, student_id, description, amount_due, amount_paid, due_date")
        .eq("institution_id", inst.id)
        .neq("status", "paid")
        .lte("due_date", inDays(7).toISOString().slice(0, 10));
      const feeReminders = (fees ?? []).map((f) => ({
        user_id: f.student_id, kind: "reminder", link: "/fees", ref: `fee:${f.id}:${today()}`,
        title: `Reminder: ${f.description} ${f.due_date < today() ? "overdue since" : "due"} ${f.due_date}`,
        body: `Balance ${money(f.amount_due - f.amount_paid, inst.currency)}.`,
      }));

      const rows = [...assignmentReminders, ...feeReminders].map((r) => ({ ...r, institution_id: inst.id, agent_run_id: run?.id }));
      const { data: inserted } = rows.length
        ? await db.from("notifications").upsert(rows, { onConflict: "user_id,ref", ignoreDuplicates: true }).select("id")
        : { data: [] };
      const output = { assignment_reminders: assignmentReminders.length, fee_reminders: feeReminders.length, new: inserted?.length ?? 0 };
      await db.from("agent_runs").update({ status: "succeeded", output, finished_at: new Date().toISOString() }).eq("id", run!.id);
      results.push({ institution: inst.id, ...output });
    } catch (e) {
      await db.from("agent_runs").update({ status: "failed", error: String(e), finished_at: new Date().toISOString() }).eq("id", run!.id);
    }
  }
  return results;
}

// ───────── Ops agent (weekly or on admin request) ─────────

export type OpsFigures = {
  currency: string;
  outstanding: { student_id: string; student: string; fee_id: string; description: string; balance: number; due_date: string; overdue: boolean }[];
  outstanding_total: number;
  late: { student: string; assignment: string; course: string; status: "late" | "missing" }[];
  ratings: { course: string; professor: string; average: number; count: number; overview: string }[];
};

const digestSchema = z.object({
  headline: z.string().describe("One-line summary of the week"),
  narrative: z.string().describe("3-5 sentences for the admin. Use only the figures given."),
  suggested_actions: z.array(z.string()).max(4),
  announcement: z.object({ title: z.string(), body: z.string().describe("2-3 sentences to all students: what is due, when, and where to pay. Nothing else") }).nullable()
    .describe("A college-wide announcement draft, only if one would help (e.g. a fee deadline is near); otherwise null"),
});
export type Digest = z.infer<typeof digestSchema>;

// Figures come straight from SQL, so the digest always matches the database. The model only writes prose.
export async function opsFigures(institutionId: string): Promise<OpsFigures> {
  const db = createServiceClient();
  const since = new Date(Date.now() - 14 * DAY).toISOString();
  const [{ data: inst }, { data: fees }, { data: past }, { data: courses }] = await Promise.all([
    db.from("institutions").select("currency").eq("id", institutionId).single(),
    db.from("fee_records").select("id, student_id, description, amount_due, amount_paid, due_date, student:profiles(full_name)").eq("institution_id", institutionId).neq("status", "paid").order("due_date"),
    db.from("assignments").select("title, course:courses(code, enrollments(student_id, student:profiles(full_name))), submissions(student_id, is_late)")
      .eq("institution_id", institutionId).gte("due_at", since).lt("due_at", new Date().toISOString()),
    db.from("courses").select("code, professor:profiles(full_name), professor_ratings(rating), rating_summaries(themes)").eq("institution_id", institutionId),
  ]);

  const outstanding = (fees ?? []).map((f) => ({
    student_id: f.student_id, student: f.student?.full_name ?? "", fee_id: f.id, description: f.description,
    balance: f.amount_due - f.amount_paid, due_date: f.due_date, overdue: f.due_date < today(),
  }));
  const late = (past ?? []).flatMap((a) =>
    (a.course?.enrollments ?? []).flatMap((e) => {
      const sub = a.submissions.find((s) => s.student_id === e.student_id);
      if (sub && !sub.is_late) return [];
      return [{ student: e.student?.full_name ?? "", assignment: a.title, course: a.course?.code ?? "", status: sub ? "late" as const : "missing" as const }];
    })
  );
  const ratings = (courses ?? []).filter((c) => c.professor_ratings.length).map((c) => {
    const themes = c.rating_summaries ? (JSON.parse(c.rating_summaries.themes) as Themes) : null;
    return {
      course: c.code, professor: c.professor?.full_name ?? "", count: c.professor_ratings.length,
      average: Math.round((c.professor_ratings.reduce((s, r) => s + r.rating, 0) / c.professor_ratings.length) * 100) / 100,
      overview: themes?.overview ?? "",
    };
  });
  return { currency: inst?.currency ?? "USD", outstanding, outstanding_total: outstanding.reduce((s, o) => s + o.balance, 0), late, ratings };
}

export async function runOpsDigest(institutionId: string, trigger: "schedule" | "event", requestedBy?: string) {
  const figures = await opsFigures(institutionId);
  const res = await runAgent({
    agent: "ops",
    trigger,
    institutionId,
    userId: requestedBy,
    input: figures as unknown as Json, // the digest page reads figures from here, even if the model call fails
    instructions: `You are the Ops agent for a college admin. Write a short weekly digest from the figures provided.
- Use ONLY the numbers given; never estimate or add figures. Amounts are in ${figures.currency}.
- Name the most urgent follow-ups. Be factual and brief. Refer to people by name, not pronouns.
- Suggested actions must be things the admin can do in Kibo: approve the fee reminder batch, approve the announcement draft, or follow up with a named student or professor. No emails, no system changes.
- If a college announcement would help, write it in "announcement" (it is drafted for the admin to approve). It may say only what is due, the due date, and "Pay from the Fees page in Kibo". Never name students or amounts owed, and never mention consequences (penalties, registration, late fees): none are in the figures.`,
    prompt: `Outstanding fees (${figures.outstanding.length}, total ${money(figures.outstanding_total, figures.currency)}):
${figures.outstanding.map((o) => `- ${o.student}: ${o.description}, ${money(o.balance, figures.currency)}, due ${o.due_date}${o.overdue ? " (OVERDUE)" : ""}`).join("\n") || "- none"}

Late or missing submissions (last 14 days, ${figures.late.length}):
${figures.late.map((l) => `- ${l.student}: ${l.course} ${l.assignment} (${l.status})`).join("\n") || "- none"}

Professor ratings:
${figures.ratings.map((r) => `- ${r.course} ${r.professor}: ${r.average}/5 from ${r.count}. ${r.overview}`).join("\n") || "- none yet"}`,
    schema: digestSchema,
  });

  const db = createServiceClient();
  // A new digest replaces the previous digest's undecided drafts.
  await db.from("approvals").update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("institution_id", institutionId).eq("kind", "announcement").eq("status", "pending").eq("payload->>source", "ops");
  if (res.ok && res.output.announcement) {
    await db.from("approvals").insert({
      institution_id: institutionId, kind: "announcement", reviewer_role: "admin", agent_run_id: res.runId,
      payload: { source: "ops", title: res.output.announcement.title, body: res.output.announcement.body },
    });
  }

  // Fee reminder batch for the admin to approve. Prepared even if the prose failed: it's built from figures.
  if (figures.outstanding.length) {
    await db.from("approvals").update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("institution_id", institutionId).eq("kind", "reminder_batch").eq("status", "pending");
    await db.from("approvals").insert({
      institution_id: institutionId, kind: "reminder_batch", reviewer_role: "admin", agent_run_id: res.runId,
      payload: {
        title: `Fee reminders for ${figures.outstanding.length} fee record(s)`,
        message: "This is a reminder that your fee payment is due. Please pay from the Fees page in Kibo.",
        students: figures.outstanding.map(({ student_id, student, fee_id, description, balance, due_date }) => ({ student_id, student, fee_id, description, balance, due_date })),
        currency: figures.currency,
      },
    });
  }
  return res;
}
