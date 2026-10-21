import type { Precheck } from "@/lib/agents";
import { SubmitButton } from "@/components/submit-button";

const mark = { met: "✓", partial: "◐", missing: "✗" } as const;
const color = { met: "text-green-700", partial: "text-amber-700", missing: "text-red-700" } as const;

// "Prepared by agent" label used wherever AI output is shown.
export function AgentLabel({ name }: { name: string }) {
  return <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800">Prepared by {name}</span>;
}

export function PrecheckCard({ status, precheck, retry }: { status: string; precheck: Precheck | null; retry?: () => Promise<void> }) {
  return (
    <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/50 p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Rubric pre-check</p>
        <AgentLabel name="Submission agent" />
      </div>
      {status === "pending" && <p className="text-gray-600">Checking your file against the rubric…</p>}
      {status === "failed" && (
        <div className="text-red-700">
          <p>{precheck?.summary ?? "The pre-check couldn't run (AI service unavailable). Your submission is saved."}</p>
          {retry && <form action={retry}><SubmitButton pending="Retrying…" className="mt-1 underline disabled:opacity-50">Retry pre-check</SubmitButton></form>}
        </div>
      )}
      {status === "done" && precheck && (
        <>
          <p>{precheck.summary}</p>
          <ul className="space-y-1">
            {precheck.items.map((it) => (
              <li key={it.rubric_item}>
                <span className={`font-medium ${color[it.status]}`}>{mark[it.status]} {it.rubric_item}</span>
                <span className="text-gray-600"> — {it.note}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">This is an automatic check, not your grade. Your professor reviews and grades.</p>
        </>
      )}
    </div>
  );
}
