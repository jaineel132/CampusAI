import type { Precheck } from "@/lib/agents";
import { SubmitButton } from "@/components/submit-button";

const mark = { met: "✓", partial: "◐", missing: "✗" } as const;
const color = { met: "text-ok-ink", partial: "text-warn-ink", missing: "text-danger-ink" } as const;

// "Prepared by agent" label used wherever AI output is shown.
export function AgentLabel({ name }: { name: string }) {
  return <span className="sticker">✦ {name}</span>;
}

export function PrecheckCard({ status, precheck, retry }: { status: string; precheck: Precheck | null; retry?: () => Promise<void> }) {
  return (
    <div className="space-y-2 rounded-lg border border-line bg-info/25 p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">Rubric pre-check</p>
        <AgentLabel name="Submission agent" />
      </div>
      {status === "pending" && <p className="text-ink/70">Checking your file against the rubric…</p>}
      {status === "failed" && (
        <div className="text-danger-ink">
          <p>{precheck?.summary ?? "The pre-check couldn't run (AI service unavailable). Your submission is saved."}</p>
          {retry && <form action={retry}><SubmitButton pending="Retrying…" className="btn-ghost btn-sm mt-2">Retry pre-check</SubmitButton></form>}
        </div>
      )}
      {status === "done" && precheck && (
        <>
          <p>{precheck.summary}</p>
          <ul className="space-y-1">
            {precheck.items.map((it) => (
              <li key={it.rubric_item}>
                <span className={`font-medium ${color[it.status]}`}>{mark[it.status]} {it.rubric_item}</span>
                <span className="text-ink/70"> — {it.note}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink/70">This is an automatic check, not your grade. Your professor reviews and grades.</p>
        </>
      )}
    </div>
  );
}
