import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getMe } from "@/lib/supabase";
import { runOpsDigest, type Digest, type OpsFigures } from "@/lib/jobs";
import { money } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { AgentLabel } from "@/components/precheck";
import { RunDigestButton } from "./run-button";

export const maxDuration = 60;

async function runNow() {
  "use server";
  const me = await getMe();
  if (me.role !== "admin") return;
  await runOpsDigest(me.institution.id, "event", me.id);
  revalidatePath("/ops");
  revalidatePath("/", "layout");
}

const card = "rounded-xl border border-gray-200 bg-white p-5";

export default async function OpsPage() {
  const me = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const db = await createClient();
  // RLS: admins can read their college's agent runs.
  const [{ data: run }, { count: batchPending }] = await Promise.all([
    db.from("agent_runs").select("status, error, input, output, started_at, trigger").eq("agent", "ops").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("approvals").select("id", { count: "exact", head: true }).eq("kind", "reminder_batch").eq("status", "pending"),
  ]);
  const f = run?.input as unknown as OpsFigures | undefined;
  const d = run?.output as unknown as Digest | undefined;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Ops digest</h1>
          <p className="text-sm text-gray-500">
            {run ? <>Generated <LocalTime iso={run.started_at} /> ({run.trigger === "schedule" ? "weekly schedule" : "on request"})</> : "No digest yet."}
          </p>
        </div>
        <form action={runNow}><RunDigestButton /></form>
      </div>

      {run?.status === "failed" && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          The AI summary failed ({run.error?.slice(0, 120)}). The figures below are still accurate. Try running it again.
        </p>
      )}

      {d && (
        <section className={`${card} space-y-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{d.headline}</h2>
            <AgentLabel name="Ops agent" />
          </div>
          <p className="text-sm text-gray-700">{d.narrative}</p>
          {!!d.suggested_actions.length && (
            <ul className="list-disc pl-5 text-sm text-gray-700">{d.suggested_actions.map((a) => <li key={a}>{a}</li>)}</ul>
          )}
        </section>
      )}

      {!!batchPending && (
        <Link href="/inbox" className="block rounded-lg bg-violet-50 p-3 text-sm text-violet-800 hover:underline">
          A fee reminder batch is waiting for your approval in the inbox →
        </Link>
      )}

      {f && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className={card}>
            <h2 className="font-medium">Outstanding fees · {money(f.outstanding_total, f.currency)}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {f.outstanding.map((o) => (
                <li key={o.fee_id}>
                  {o.student} · {o.description} · <span className="font-medium">{money(o.balance, f.currency)}</span>
                  <span className={o.overdue ? "text-red-600" : "text-gray-500"}> · {o.overdue ? "overdue" : "due"} {o.due_date}</span>
                </li>
              ))}
              {!f.outstanding.length && <li className="text-gray-500">All fees paid.</li>}
            </ul>
          </section>
          <section className={card}>
            <h2 className="font-medium">Late or missing submissions (14 days)</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {f.late.map((l, i) => (
                <li key={i}>{l.student} · {l.course} {l.assignment} <span className={l.status === "missing" ? "text-red-600" : "text-amber-700"}>· {l.status}</span></li>
              ))}
              {!f.late.length && <li className="text-gray-500">None.</li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
