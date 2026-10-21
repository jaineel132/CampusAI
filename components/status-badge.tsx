// Submission state for a student: Submitted / Submitted late / Missing / To do
export function StatusBadge({ submitted, late, overdue }: { submitted: boolean; late?: boolean; overdue: boolean }) {
  if (submitted) return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">{late ? "Submitted late" : "Submitted"}</span>;
  if (overdue) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Missing</span>;
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">To do</span>;
}
