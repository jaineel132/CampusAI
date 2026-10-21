import { redirect } from "next/navigation";
import { createClient, getMe } from "@/lib/supabase";
import { LocalTime } from "@/components/local-time";
import { ApprovalCard, approvalTitle, s } from "@/components/approval";

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
        <h1 className="text-xl font-semibold">Approval inbox</h1>
        <p className="text-sm text-gray-500">Agents prepared these. Nothing is published or sent until you approve. You can also approve each one right where it happened.</p>
      </div>

      {(pending ?? []).map((a) => <ApprovalCard key={a.id} a={a} />)}
      {!pending?.length && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Nothing waiting for you. 🎉</p>}

      {!!decided?.length && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-200 p-4 font-medium">Recently decided</h2>
          <ul className="divide-y divide-gray-100">
            {decided.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
                <span>{approvalTitle[a.kind]} · {s((a.payload as P).title) || s((a.payload as P).assignment_title)}</span>
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
