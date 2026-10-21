import { LocalTime } from "@/components/local-time";
import { AgentLabel } from "@/components/precheck";
import type { Precheck } from "@/lib/agents";
import { money } from "@/lib/format";
import { ApprovalActions, type EditableField } from "@/app/(app)/inbox/approval-card";

const agentFor: Record<string, string> = {
  feedback_draft: "Submission agent",
  announcement: "Materials agent",
  reminder_batch: "Ops agent",
  assignment_draft: "Assignment agent",
};
export const approvalTitle: Record<string, string> = {
  feedback_draft: "Feedback draft",
  announcement: "Announcement draft",
  reminder_batch: "Fee reminder batch",
  assignment_draft: "Assignment draft",
};

type P = Record<string, unknown>;
export const s = (v: unknown) => (typeof v === "string" ? v : "");
export type PendingApproval = { id: string; kind: string; payload: unknown; created_at: string };

// One pending agent draft with Approve / Edit / Reject. Shown in the inbox and right next to what it's about.
// `inline` drops the context the surrounding page already shows (course, file, student).
export function ApprovalCard({ a, inline = false }: { a: PendingApproval; inline?: boolean }) {
  const p = a.payload as P;
  const rubric = Array.isArray(p.rubric) ? (p.rubric as string[]) : [];
  return (
    <section className={`space-y-3 rounded-xl border p-5 ${inline ? "border-violet-200 bg-violet-50/40" : "border-gray-200 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">
          {approvalTitle[a.kind]}
          {inline ? " · waiting for your approval" : ` · ${s(p.course_code) || "College"}`}
        </h2>
        <span className="flex items-center gap-2 text-xs text-gray-500"><AgentLabel name={agentFor[a.kind]} /> <LocalTime iso={a.created_at} /></span>
      </div>

      {a.kind === "announcement" && (
        <>
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <p className="font-medium">{s(p.title)}</p>
            <p className="mt-1 text-gray-700">{s(p.body)}</p>
          </div>
          {!inline && (
            <p className="text-xs text-gray-500">
              Data used: <a href={`/files/document/${s(p.document_id)}`} target="_blank" className="underline">{s(p.document_title)}</a>
              {" — "}{s(p.summary)}
            </p>
          )}
        </>
      )}

      {a.kind === "feedback_draft" && (
        <>
          {!inline && (
            <p className="text-sm">
              <span className="font-medium">{s(p.student_name)}</span> · {s(p.assignment_title)} ·{" "}
              <a href={`/files/submission/${s(p.submission_id)}`} target="_blank" className="underline">{s(p.file_name)}</a>
            </p>
          )}
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
          {!inline && <p className="text-xs text-gray-500">Data used: fee records from the latest <a href="/ops" className="underline">Ops digest</a>.</p>}
        </>
      )}

      {a.kind === "assignment_draft" && (
        <>
          <p className="text-xs text-gray-500">From {s(p.file_name)}. Students will also see the original PDF.</p>
          <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
            <p className="font-medium">{s(p.title)}</p>
            <p className="max-h-48 overflow-y-auto whitespace-pre-line text-gray-700">{s(p.instructions)}</p>
            <div>
              <p className="text-xs text-gray-500">
                Rubric {p.rubric_source === "derived" ? "(the PDF has none, so the agent built it from the requirements; please check)" : "(from the PDF)"}
              </p>
              <ul className="list-disc pl-5">{rubric.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
            {p.due_local ? (
              <p>Deadline: <span className="font-medium">{s(p.due_local).replace("T", " ")}</span>{p.due_quote ? <span className="text-gray-500"> (PDF says “{s(p.due_quote)}”)</span> : null}</p>
            ) : (
              <p className="text-amber-700">No deadline found in the PDF. Set one below before approving.</p>
            )}
          </div>
        </>
      )}

      <ApprovalActions id={a.id} editable={editableFor(a.kind, p, rubric)} open={a.kind === "assignment_draft" && !p.due_local} />
    </section>
  );
}

function editableFor(kind: string, p: P, rubric: string[]): EditableField[] {
  if (kind === "announcement") return [{ name: "title", label: "Title", value: s(p.title) }, { name: "body", label: "Message", value: s(p.body), rows: 4 }];
  if (kind === "feedback_draft") return [{ name: "feedback", label: "Feedback", value: s(p.feedback), rows: 6 }];
  if (kind === "assignment_draft")
    return [
      { name: "title", label: "Title", value: s(p.title) },
      { name: "instructions", label: "Instructions", value: s(p.instructions), rows: 8 },
      { name: "rubric", label: "Rubric (one item per line)", value: rubric.join("\n"), rows: 5 },
      { name: "due_at", label: "Deadline", value: s(p.due_local), due: true },
    ];
  return [{ name: "message", label: "Message", value: s(p.message), rows: 3 }];
}
