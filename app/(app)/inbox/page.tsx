import { redirect } from "next/navigation";
import { createClient, getMe } from "@/lib/supabase";
import { LocalTime } from "@/components/local-time";
import { AgentLabel } from "@/components/precheck";
import type { Precheck } from "@/lib/agents";
import { money } from "@/lib/format";
import { ApprovalActions } from "./approval-card";

const agentFor: Record<string, string> = {
  feedback_draft: "Submission agent",
  announcement: "Materials agent",
  reminder_batch: "Ops agent",
};
const title: Record<string, string> = {
  feedback_draft: "Feedback draft",
  announcement: "Announcement draft",
  reminder_batch: "Fee reminder batch",
};

type P = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");

export default async function InboxPage() {
  const me = await getMe();
  if (me.role === "student") redirect("/dashboard");
  const db = await createClient();
  // RLS: professors see items for courses they teach; admins see admin-level items.
  const [{ data: pending }, { data: decided }] = await Promise.all([
    db.from("approvals").select("id, kind, payload, created_at").eq("status", "pending").order("created_at", { ascending: false }),
    db.from("approvals").select("id, kind, payload, status, decided_at").neq("status", "pending").order("decided_at", { ascending: false }).limit(10),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Approval inbox</h1>
        <p className="text-sm text-gray-500">Agents prepared these. Nothing is published or sent until you approve.</p>
      </div>

      {(pending ?? []).map((a) => {
        const p = a.payload as P;
        return (
          <section key={a.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">{title[a.kind]} · {s(p.course_code) || "College"}</h2>
              <span className="flex items-center gap-2 text-xs text-gray-500"><AgentLabel name={agentFor[a.kind]} /> <LocalTime iso={a.created_at} /></span>
            </div>

            {a.kind === "announcement" && (
              <>
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <p className="font-medium">{s(p.title)}</p>
                  <p className="mt-1 text-gray-700">{s(p.body)}</p>
                </div>
                <p className="text-xs text-gray-500">
                  Data used: <a href={`/files/document/${s(p.document_id)}`} target="_blank" className="underline">{s(p.document_title)}</a>
                  {" — "}{s(p.summary)}
                </p>
              </>
            )}

            {a.kind === "feedback_draft" && (
              <>
                <p className="text-sm">
                  <span className="font-medium">{s(p.student_name)}</span> · {s(p.assignment_title)} ·{" "}
                  <a href={`/files/submission/${s(p.submission_id)}`} target="_blank" className="underline">{s(p.file_name)}</a>
                </p>
                <ul className="space-y-1 text-sm">
                  {((p.items as Precheck["items"]) ?? []).map((it) => (
                    <li key={it.rubric_item}>
                      <span className="font-medium">{it.status === "met" ? "✓" : it.status === "partial" ? "◐" : "✗"} {it.rubric_item}</span>
                      <span className="text-gray-600"> — {it.note}</span>
                    </li>
                  ))}
                </ul>
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <p className="text-xs text-gray-500">Draft feedback (sent to the student on approval)</p>
                  <p className="mt-1 whitespace-pre-line">{s(p.feedback)}</p>
                  <p className="mt-2 text-xs text-gray-500">Indicative grade (only you see this; you decide the final grade): {s(p.indicative_grade)}</p>
                </div>
              </>
            )}

            {a.kind === "reminder_batch" && (
              <>
                <p className="text-sm">Send a fee reminder to these students&apos; activity feeds:</p>
                <ul className="space-y-1 text-sm">
                  {((p.students as { student: string; description: string; balance: number; due_date: string }[]) ?? []).map((st, i) => (
                    <li key={i}>
                      {st.student} · {st.description} · <span className="font-medium">{money(st.balance, s(p.currency))}</span>
                      <span className="text-gray-500"> · due {st.due_date}</span>
                    </li>
                  ))}
                </ul>
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <p className="text-xs text-gray-500">Message</p>
                  <p className="mt-1">{s(p.message)}</p>
                </div>
                <p className="text-xs text-gray-500">Data used: fee records from the latest <a href="/ops" className="underline">Ops digest</a>.</p>
              </>
            )}

            <ApprovalActions
              id={a.id}
              editable={
                a.kind === "announcement"
                  ? [{ name: "title", label: "Title", value: s(p.title) }, { name: "body", label: "Message", value: s(p.body), rows: 4 }]
                  : a.kind === "feedback_draft"
                    ? [{ name: "feedback", label: "Feedback", value: s(p.feedback), rows: 6 }]
                    : [{ name: "message", label: "Message", value: s(p.message), rows: 3 }]
              }
            />
          </section>
        );
      })}
      {!pending?.length && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Nothing waiting for you. 🎉</p>}

      {!!decided?.length && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-200 p-4 font-medium">Recently decided</h2>
          <ul className="divide-y divide-gray-100">
            {decided.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
                <span>{title[a.kind]} · {s((a.payload as P).title) || s((a.payload as P).assignment_title)}</span>
                <span className={a.status === "approved" ? "text-green-700" : "text-gray-500"}>
                  {a.status} {a.decided_at && <LocalTime iso={a.decided_at} />}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
