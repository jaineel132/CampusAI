import { redirect } from "next/navigation";
import { createClient, getMe } from "@/lib/supabase";
import { LocalTime } from "@/components/local-time";
import { ApprovalCard, approvalTitle, s } from "@/components/approval";
import { Disclosure } from "@/components/disclosure";

type P = Record<string, unknown>;

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
        <h1 className="heading">Approval inbox</h1>
        <p className="text-sm text-ink/70">Agents prepared these. Nothing is published or sent until you approve. You can also approve each one right where it happened.</p>
      </div>

      {(pending ?? []).map((a, i) => <ApprovalCard key={a.id} a={a} fold={{ open: i === 0 }} />)}
      {!pending?.length && <p className="card p-5 text-sm text-ink/70">Nothing waiting for you. ✓</p>}

      {!!decided?.length && (
        <Disclosure className="card p-4" title={<h2 className="section-title">Recently decided</h2>} meta={<span className="badge bg-white">{decided.length}</span>}>
          <ul className="divide-y divide-line border-t border-line">
            {decided.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>{approvalTitle[a.kind]} · {s((a.payload as P).title) || s((a.payload as P).assignment_title)}</span>
                <span className={a.status === "approved" ? "text-ok-ink" : "text-ink/70"}>
                  {a.status} {a.decided_at && <LocalTime iso={a.decided_at} />}
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}
