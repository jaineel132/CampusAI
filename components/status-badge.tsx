// Submission state for a student: Submitted / Submitted late / Missing / To do
export function StatusBadge({ submitted, late, overdue }: { submitted: boolean; late?: boolean; overdue: boolean }) {
  if (submitted) return <span className="badge bg-ok">{late ? "Submitted late" : "Submitted"}</span>;
  if (overdue) return <span className="badge bg-danger">Missing</span>;
  return <span className="badge bg-warn">To do</span>;
}
