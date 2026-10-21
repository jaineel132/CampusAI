import Link from "next/link";
import { after } from "next/server";
import { createClient, getMe, type Me } from "@/lib/supabase";
import { daysFromNow, isPast, money, olderThanHours, plural, relative } from "@/lib/format";
import { plannerAgent, type Plan } from "@/lib/agents";
import { AgentLabel } from "@/components/precheck";
import { AutoRefresh } from "@/components/auto-refresh";
import { SubmitButton } from "@/components/submit-button";
import { refreshPlan } from "./actions";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";
import { Disclosure } from "@/components/disclosure";

const card = "card p-5";

export default async function Dashboard() {
  const me = await getMe();
  const i = me.institution;
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="heading">Welcome, {me.role === "student" ? me.full_name.split(" ")[0] : me.full_name}</h1>
        <p className="text-sm text-ink/70">{i.name} · {i.current_term}</p>
      </div>
      {me.role === "student" && <StudentDashboard me={me} />}
      {me.role === "professor" && <ProfessorDashboard me={me} />}
      {me.role === "admin" && <AdminDashboard me={me} />}
      <Announcements />
    </div>
  );
}

async function StudentDashboard({ me }: { me: Me }) {
  const db = await createClient();
  const weekAgo = daysFromNow(-7);
  const [{ data: assignments }, { data: submissions }, { data: fees }] = await Promise.all([
    db.from("assignments").select("id, title, due_at, course:courses(code)").gte("due_at", weekAgo).order("due_at").limit(8),
    db.from("submissions").select("assignment_id, is_late").eq("student_id", me.id),
    db.from("fee_records").select("amount_due, amount_paid, due_date").eq("student_id", me.id).neq("status", "paid").order("due_date"),
  ]);
  const done = new Map((submissions ?? []).map((s) => [s.assignment_id, s]));
  // Hide past deadlines that were already handed in; keep missing ones visible.
  const deadlines = (assignments ?? []).filter((a) => !isPast(a.due_at) || !done.has(a.id));
  const balance = (fees ?? []).reduce((s, f) => s + f.amount_due - f.amount_paid, 0);
  const todo = deadlines.filter((a) => !done.has(a.id));

  // Focus first (plan + money), everything else folded with its key fact in the summary line.
  return (
    <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-3">
      <WeekPlan me={me} />
      <Link href="/fees" className={`card-link self-start p-5 ${balance > 0 ? "bg-yellow" : "bg-mint"}`}>
        <h2 className="section-title">Fee balance</h2>
        <p className="mt-2 text-3xl font-bold">{money(balance, me.institution.currency)}</p>
        <p className="text-xs text-ink/70">{fees?.[0] ? `Next due ${fees[0].due_date}` : "All paid"}</p>
      </Link>

    </div>

      <Disclosure className={card}
        title={<h2 className="section-title">Upcoming deadlines</h2>}
        meta={<span className="text-xs muted">{todo[0] ? <>Next: <b>{todo[0].title}</b> ({relative(todo[0].due_at)}) · {todo.length} to do</> : "Nothing to do 🎉"}</span>}>
        <ul className="divide-y divide-ink/15">
          {deadlines.map((a) => (
            <li key={a.id}>
              <Link href={`/assignments/${a.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:underline">
                <span>{a.course?.code} · {a.title} <span className="text-ink/70">({relative(a.due_at)})</span></span>
                <StatusBadge submitted={done.has(a.id)} late={done.get(a.id)?.is_late} overdue={isPast(a.due_at)} />
              </Link>
            </li>
          ))}
          {!deadlines.length && <li className="py-2 text-sm text-ink/70">Nothing due. 🎉</li>}
        </ul>
      </Disclosure>

      <ActivityFeed me={me} />
    </div>
  );
}

const tone = { high: "bg-danger", medium: "bg-yellow", low: "bg-white" } as const;

// Planner agent on dashboard load: reuse a plan younger than 12 h, otherwise prepare a new one in the background.
async function WeekPlan({ me }: { me: Me }) {
  const db = await createClient();
  const { data: run } = await db
    .from("agent_runs")
    .select("status, output, started_at")
    .eq("agent", "planner")
    .eq("user_id", me.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const running = run?.status === "running" && !olderThanHours(run.started_at, 0.05);
  const stale = !run || olderThanHours(run.started_at, 12);
  if (stale && !running) after(() => plannerAgent(me.id));
  const plan = run?.status === "succeeded" ? (run.output as unknown as Plan) : null;

  return (
    <section className={`${card} space-y-3 md:col-span-2`}>
      <AutoRefresh active={running || stale} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">This week&apos;s plan</h2>
        <AgentLabel name="Planner agent" />
      </div>
      {(running || stale) && <p className="text-sm text-ink/70">The Planner agent is preparing your week from your deadlines and fees…</p>}
      {!running && !stale && run?.status === "failed" && <p className="text-sm text-danger-ink">Couldn&apos;t build a plan (AI unavailable).</p>}
      {plan && !stale && (
        <>
          <p className="text-sm text-ink/85">{plan.summary}</p>
          <ol className="space-y-2 text-sm">
            {plan.items.map((it, n) => (
              <li key={it.title} className="flex items-start gap-3 rounded-md border-2 border-ink bg-cream p-2">
                <span className={`grid size-7 shrink-0 place-items-center rounded-md border-2 border-ink font-bold ${tone[it.priority]}`} aria-label={`${it.priority} priority`}>{n + 1}</span>
                <span>
                  <Link href={it.link} className="link font-bold">{it.title}</Link>
                  <span className="text-ink/70"> — {it.why}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {run && !running && !stale && (
        <form action={refreshPlan} className="text-xs text-ink/70">
          Updated {relative(run.started_at)} · <SubmitButton pending="Refreshing…" className="btn-ghost btn-sm ml-1">Refresh plan</SubmitButton>
        </form>
      )}
    </section>
  );
}

const icon: Record<string, string> = { reminder: "⏰", fee_reminder: "💳", payment: "✅", feedback: "📝", submission: "🤖" };

// What agents did for this student: reminders, released feedback, payments, pre-checks.
async function ActivityFeed({ me }: { me: Me }) {
  const db = await createClient();
  const [{ data: notes }, { data: runs }] = await Promise.all([
    db.from("notifications").select("id, kind, title, body, link, created_at").eq("user_id", me.id).order("created_at", { ascending: false }).limit(8),
    db.from("agent_runs").select("id, status, started_at, input").eq("user_id", me.id).eq("agent", "submission").order("started_at", { ascending: false }).limit(4),
  ]);
  const items = [
    ...(notes ?? []).map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, at: n.created_at })),
    ...(runs ?? []).map((r) => ({
      id: r.id, kind: "submission", at: r.started_at, body: null,
      link: `/assignments/${(r.input as { assignment_id?: string })?.assignment_id ?? ""}`,
      title: r.status === "failed" ? "Submission agent couldn't pre-check your file" : `Submission agent pre-checked ${(r.input as { file_name?: string })?.file_name ?? "your file"}`,
    })),
  ].toSorted((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  return (
    <Disclosure className={card}
      title={<h2 className="section-title">Agent activity</h2>}
      meta={<span className="text-xs muted">{items[0] ? <>Latest: {items[0].title} · {relative(items[0].at)}</> : "Nothing yet"}</span>}>
      <ul className="space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.id} className="flex gap-2">
            <span aria-hidden>{icon[it.kind] ?? "•"}</span>
            <span>
              {it.link ? <Link href={it.link} className="hover:underline">{it.title}</Link> : it.title}
              {it.body && <span className="block text-xs text-ink/70">{it.body}</span>}
              <span className="block text-xs text-ink/60">{relative(it.at)}</span>
            </span>
          </li>
        ))}
        {!items.length && <li className="text-ink/70">Nothing yet. Reminders and agent results show up here.</li>}
      </ul>
    </Disclosure>
  );
}

async function ProfessorDashboard({ me }: { me: Me }) {
  const db = await createClient();
  const [{ data: courses }, { data: recent }] = await Promise.all([
    db.from("courses").select("id, code, name, enrollments(count), assignments(count)").eq("professor_id", me.id).order("code"),
    db.from("submissions").select("id, submitted_at, is_late, student:profiles(full_name), assignment:assignments(id, title)").order("submitted_at", { ascending: false }).limit(5),
  ]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className={card}>
        <h2 className="section-title">Your courses</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(courses ?? []).map((c) => (
            <li key={c.id}>{c.code} — {c.name} <span className="text-ink/70">· {plural(c.enrollments?.[0]?.count ?? 0, "student")} · {plural(c.assignments?.[0]?.count ?? 0, "assignment")}</span></li>
          ))}
        </ul>
      </section>
      <section className={card}>
        <h2 className="section-title">Recent submissions</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(recent ?? []).map((s) => (
            <li key={s.id}>
              <Link href={`/assignments/${s.assignment?.id}`} className="hover:underline">{s.student?.full_name} · {s.assignment?.title}</Link>
              <span className="text-ink/70"> · <LocalTime iso={s.submitted_at} />{s.is_late && " · late"}</span>
            </li>
          ))}
          {!recent?.length && <li className="text-ink/70">No submissions yet.</li>}
        </ul>
      </section>
    </div>
  );
}

const statTone: Record<string, string> = { "Outstanding fees": "bg-yellow", "Unpaid fee records": "bg-pink", Students: "bg-sky", "Late submissions": "bg-mint" };

async function AdminDashboard({ me }: { me: Me }) {
  const db = await createClient();
  const [{ data: fees }, { count: students }, { count: late }] = await Promise.all([
    db.from("fee_records").select("amount_due, amount_paid").neq("status", "paid"),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    db.from("submissions").select("id", { count: "exact", head: true }).eq("is_late", true),
  ]);
  const outstanding = (fees ?? []).reduce((s, f) => s + f.amount_due - f.amount_paid, 0);
  const stats: [string, string | number, string?][] = [
    ["Outstanding fees", money(outstanding, me.institution.currency), "/fees"],
    ["Unpaid fee records", fees?.length ?? 0, "/fees"],
    ["Students", students ?? 0],
    ["Late submissions", late ?? 0],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
      {stats.map(([label, value, href]) => {
        const body = (<><p className="text-xs font-bold uppercase tracking-wide">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p></>);
        return href ? <Link key={label} href={href} className={`card-link p-5 ${statTone[label]}`}>{body}</Link> : <div key={label} className={`${card} ${statTone[label]}`}>{body}</div>;
      })}
    </div>
  );
}

async function Announcements() {
  const db = await createClient();
  // RLS: only announcements for my courses or the whole college.
  const { data } = await db.from("announcements").select("id, title, body, published_at, course:courses(code)").order("published_at", { ascending: false }).limit(5);
  return (
    <Disclosure className={card}
      title={<h2 className="section-title">Announcements</h2>}
      meta={<span className="text-xs muted">{data?.[0] ? <>Latest: <b>{data[0].title}</b> · {plural(data.length, "post")}</> : "None yet"}</span>}>
      <ul className="divide-y divide-ink/15">
        {(data ?? []).map((a) => (
          <li key={a.id} className="py-2 text-sm">
            <p className="font-medium">{a.course?.code ? `${a.course.code} · ` : "College · "}{a.title}</p>
            <p className="text-ink/70">{a.body}</p>
            <p className="text-xs text-ink/60"><LocalTime iso={a.published_at} /></p>
          </li>
        ))}
        {!data?.length && <li className="py-2 text-sm text-ink/70">No announcements.</li>}
      </ul>
    </Disclosure>
  );
}
