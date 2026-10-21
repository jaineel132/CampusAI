import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { createClient, type Me } from "./supabase";
import { embed } from "./ai";

// Assistant tools. Every query runs as the session user through RLS, so a tool can never
// return another student's or another college's data. The model never supplies a user id.
export async function assistantTools(me: Me) {
  const db = await createClient();

  return {
    search_course_notes: tool({
      description: "Search uploaded course materials the user can access. Returns passages with document title and page number.",
      inputSchema: z.object({ query: z.string().min(2).max(500).describe("What to look for in the notes") }),
      execute: async ({ query }) => {
        const [vector] = await embed([query]);
        const { data, error } = await db.rpc("match_chunks", { query_embedding: JSON.stringify(vector), match_count: 5 });
        if (error) return { error: "Search failed." };
        return {
          passages: (data ?? []).map((p) => ({
            document_id: p.document_id, title: p.title, page: p.page, similarity: Number(p.similarity.toFixed(3)), text: p.content,
          })),
        };
      },
    }),

    get_my_courses: tool({
      description: "List the courses the user is enrolled in (student), teaches (professor) or all college courses (admin).",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await db.from("courses").select("code, name, term, professor:profiles(full_name)").order("code");
        return { courses: data ?? [] };
      },
    }),

    get_deadlines: tool({
      description: "Assignments with due dates, rubric and (for students) whether the user has submitted. Use for deadlines and weekly planning.",
      inputSchema: z.object({ include_past: z.boolean().default(false).describe("Also include assignments whose deadline passed") }),
      execute: async ({ include_past }) => {
        let q = db.from("assignments").select("id, title, due_at, rubric, course:courses(code, name), submissions(submitted_at, is_late, student_id)").order("due_at");
        if (!include_past) q = q.gte("due_at", new Date(Date.now() - 864e5).toISOString());
        const { data } = await q;
        return {
          now: new Date().toISOString(),
          assignments: (data ?? []).map(({ submissions, ...a }) => ({
            ...a,
            link: `/assignments/${a.id}`,
            ...(me.role === "student"
              ? { my_submission: submissions.find((s) => s.student_id === me.id) ?? null }
              : { submission_count: submissions.length }),
          })),
        };
      },
    }),

    get_fees: tool({
      description: "Fee records and payment history. Students get their own; admins get the whole college; professors get none.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: fees }, { data: payments }] = await Promise.all([
          db.from("fee_records").select("description, term, amount_due, amount_paid, due_date, status, student:profiles(full_name)").order("due_date"),
          db.from("payments").select("amount, currency, paid_at, fee:fee_records(description)").order("paid_at", { ascending: false }),
        ]);
        return { currency: me.institution.currency, fees: fees ?? [], payments: payments ?? [], pay_link: "/fees" };
      },
    }),
  };
}
