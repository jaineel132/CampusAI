import { LocalTime } from "@/components/local-time";
import { Disclosure } from "@/components/disclosure";
import { AgentLabel } from "@/components/precheck";
import type { Precheck } from "@/lib/agents";
import { money } from "@/lib/format";
import { ApprovalActions, type EditableField } from "@/app/(app)/inbox/approval-card";

const agentFor: Record<string, string> = {
  feedback_draft: "Submission agent",
  announcement: "Materials agent",
  reminder_batch: "Report agent",
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
export function ApprovalCard({ a, inline = false, fold }: { a: PendingApproval; inline?: boolean; fold?: { open: boolean } }) {
  const p = a.payload as P;
  const rubric = Array.isArray(p.rubric) ? (p.rubric as string[]) : [];
  const heading = (
    <h2 className="section-title">
      {approvalTitle[a.kind]}
      {inline ? " · waiting for your approval" : ` · ${s(p.course_code) || "College"}`}
    </h2>
  );
  const tag = <span className="flex items-center gap-2 text-xs text-ink/70"><AgentLabel name={p.source === "ops" ? "Report agent" : agentFor[a.kind]} /> <LocalTime iso={a.created_at} /></span>;
  const body = (
    <>
      {a.kind === "announcement" && (
        <>
          <div className="rounded-lg border border-line bg-canvas p-3 text-sm">
            <p className="font-medium">{s(p.title)}</p>
            <p className="mt-1 text-ink/85">{s(p.body)}</p>
          </div>
          {!inline && p.source === "ops" && <p className="text-xs text-ink/70">Data used: the latest <a href="/ops" className="link">weekly report</a>. Goes to the whole college.</p>}
          {!inline && !!p.document_id && (
            <p className="text-xs text-ink/70">
              Data used: <a href={`/files/document/${s(p.document_id)}`} target="_blank" className="link">{s(p.document_title)}</a>
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
              <a href={`/files/submission/${s(p.submission_id)}`} target="_blank" className="link">{s(p.file_name)}</a>
            </p>
          )}
          <ul className="space-y-1 text-sm">
            {((p.items as Precheck["items"]) ?? []).map((it) => (
              <li key={it.rubric_item}>
                <span className="font-medium">{it.status === "met" ? "✓" : it.status === "partial" ? "◐" : "✗"} {it.rubric_item}</span>
                <span className="text-ink/70"> — {it.note}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-line bg-canvas p-3 text-sm">
            <p className="text-xs text-ink/70">Draft feedback (sent to the student on approval)</p>
            <p className="mt-1 whitespace-pre-line">{s(p.feedback)}</p>
            <p className="mt-2 text-xs text-ink/70">Indicative grade (only you see this; you decide the final grade): {s(p.indicative_grade)}</p>
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
                <span className="text-ink/70"> · due {st.due_date}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-line bg-canvas p-3 text-sm">
            <p className="text-xs text-ink/70">Message</p>
            <p className="mt-1">{s(p.message)}</p>
          </div>
          {!inline && <p className="text-xs text-ink/70">Data used: fee records from the latest <a href="/ops" className="link">weekly report</a>.</p>}
        </>
      )}

      {a.kind === "assignment_draft" && (
        <>
          <p className="text-xs text-ink/70">From {s(p.file_name)}. Students will also see the original PDF.</p>
          <div className="space-y-2 rounded-lg border border-line bg-canvas p-3 text-sm">
            <p className="font-medium">{s(p.title)}</p>
            <p className="max-h-48 overflow-y-auto whitespace-pre-line text-ink/85">{s(p.instructions)}</p>
            <div>
              <p className="text-xs text-ink/70">
                Rubric {p.rubric_source === "derived" ? "(the PDF has none, so the agent built it from the requirements; please check)" : "(from the PDF)"}
              </p>
              <ul className="list-disc pl-5">{rubric.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
            {p.due_local ? (
              <p>Deadline: <span className="font-medium">{s(p.due_local).replace("T", " ")}</span>{p.due_quote ? <span className="text-ink/70"> (PDF says “{s(p.due_quote)}”)</span> : null}</p>
            ) : (
              <p className="text-warn-ink">No deadline found in the PDF. Set one below before approving.</p>
            )}
          </div>
        </>
      )}

      <ApprovalActions id={a.id} editable={editableFor(a.kind, p, rubric)} open={a.kind === "assignment_draft" && !p.due_local} />
    </>
  );
  // In the inbox each draft folds to its title line; elsewhere it shows in full next to what it's about.
  if (fold) return <Disclosure open={fold.open} className="card p-5" title={heading} meta={tag}><div className="space-y-3">{body}</div></Disclosure>;
  return (
    <section className={`card space-y-3 p-5 ${inline ? "border-ai-ink/20 bg-ai/40" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">{heading}{tag}</div>
      {body}
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
