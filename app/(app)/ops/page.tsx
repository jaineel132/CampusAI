import { redirect } from "next/navigation";
import { ApprovalCard } from "@/components/approval";
import { revalidatePath } from "next/cache";
import { createClient, getMe } from "@/lib/supabase";
import { runOpsDigest, type Digest, type OpsFigures } from "@/lib/jobs";
import { money } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { AgentLabel } from "@/components/precheck";
import { SubmitButton } from "@/components/submit-button";

export const maxDuration = 60;

async function runNow() {
  "use server";
  const me = await getMe();
  if (me.role !== "admin") return;
  await runOpsDigest(me.institution.id, "event", me.id);
  revalidatePath("/ops");
  revalidatePath("/", "layout");
}

const card = "card p-5";

export default async function OpsPage() {
  const me = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const db = await createClient();
  // RLS: admins can read their college's agent runs.
  const [{ data: run }, { data: batch }, { data: announcement }] = await Promise.all([
    db.from("agent_runs").select("status, error, input, output, started_at, trigger").eq("agent", "ops").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("approvals").select("id, kind, payload, created_at").eq("kind", "reminder_batch").eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("approvals").select("id, kind, payload, created_at").eq("kind", "announcement").eq("status", "pending").eq("payload->>source", "ops").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const f = run?.input as unknown as OpsFigures | undefined;
  const d = run?.output as unknown as Digest | undefined;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading">Ops digest</h1>
          <p className="text-sm text-ink/70">
            {run ? <>Generated <LocalTime iso={run.started_at} /> ({run.trigger === "schedule" ? "weekly schedule" : "on request"})</> : "No digest yet."}
          </p>
        </div>
        <form action={runNow}><SubmitButton pending="Ops agent is working…">Run digest now</SubmitButton></form>
      </div>

      {run?.status === "failed" && (
        <p role="alert" className="rounded-md border-2 border-ink bg-danger/40 p-3 text-sm text-danger-ink">
          The AI summary failed ({run.error?.slice(0, 120)}). The figures below are still accurate. Try running it again.
        </p>
      )}

      {d && (
        <section className={`${card} space-y-2 bg-yellow`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{d.headline}</h2>
            <AgentLabel name="Ops agent" />
          </div>
          <p className="text-sm">{d.narrative}</p>
          {!!d.suggested_actions.length && (
            <ul className="space-y-1 text-sm">{d.suggested_actions.map((a) => <li key={a} className="font-medium">→ {a}</li>)}</ul>
          )}
        </section>
      )}

      {announcement && <ApprovalCard a={announcement} inline />}
      {batch && <ApprovalCard a={batch} inline />}

      {f && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className={`${card} bg-pink/30`}>
            <h2 className="section-title">Outstanding fees · {money(f.outstanding_total, f.currency)}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {f.outstanding.map((o) => (
                <li key={o.fee_id}>
                  {o.student} · {o.description} · <span className="font-medium">{money(o.balance, f.currency)}</span>
                  <span className={o.overdue ? "text-danger-ink" : "text-ink/70"}> · {o.overdue ? "overdue" : "due"} {o.due_date}</span>
                </li>
              ))}
              {!f.outstanding.length && <li className="text-ink/70">All fees paid.</li>}
            </ul>
          </section>
          <section className={`${card} bg-sky/30`}>
            <h2 className="section-title">Late or missing submissions (14 days)</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {f.late.map((l, i) => (
                <li key={i}>{l.student} · {l.course} {l.assignment} <span className={l.status === "missing" ? "text-danger-ink" : "text-warn-ink"}>· {l.status}</span></li>
              ))}
              {!f.late.length && <li className="text-ink/70">None.</li>}
            </ul>
          </section>
          <section className={`${card} bg-mint/30 md:col-span-2`}>
            <h2 className="section-title">Professor ratings</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {f.ratings.map((r) => (
                <li key={r.course}>{r.course} · {r.professor} · <span className="badge bg-yellow">{r.average}/5</span> ({r.count}) <span className="text-ink/70">{r.overview}</span></li>
              ))}
              {!f.ratings.length && <li className="text-ink/70">No ratings yet.</li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
