import { DEMO_ROLES, type DemoRole } from "@/lib/demo";

const main: DemoRole[] = ["student", "professor", "admin"];
const extra: DemoRole[] = ["student-b", "other-college"];
const tint: Record<DemoRole, string> = { student: "bg-info", professor: "bg-ai", admin: "bg-ok", "student-b": "bg-info", "other-college": "bg-warn" };

// Demo entry: pick a role, no login. Plain <a> links (not <Link>) so nothing prefetches a sign-in.
export default async function Welcome(props: PageProps<"/">) {
  const { error } = await props.searchParams;
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 p-4 py-10 md:p-10">
      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-navy">Campus<span className="text-gold">AI</span></h1>
        <p className="text-lg text-ink/80">One college app where AI agents do the busywork, for students, professors and admins.</p>
        <p className="text-sm muted">
          Pick a role to explore. Everything is already filled in by the AI agents (notes summarised, an assignment drafted from a PDF,
          submissions pre-checked, feedback, ratings, reminders and the weekly report). You can switch roles at any time.
        </p>
        {error && <p role="alert" className="text-sm text-danger-ink">The demo accounts are being reset. Try again in a minute.</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {main.map((key) => {
          const r = DEMO_ROLES[key];
          return (
            <a key={key} href={`/demo/${key}`} className="card-link flex flex-col gap-3 p-5">
              <span className={`badge self-start ${tint[key]}`}>{r.label}</span>
              <span className="text-xl font-bold">Explore as {r.label}</span>
              <span className="text-xs muted">{r.who}</span>
              <span className="text-sm text-ink/80">{r.pitch}</span>
              <ul className="list-disc space-y-1 pl-4 text-xs text-ink/70">
                {r.look.slice(0, 3).map((l) => <li key={l.did}><b>{l.agent}:</b> {l.did}</li>)}
              </ul>
              <span className="btn mt-auto">Enter as {r.label} →</span>
            </a>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {extra.map((key) => {
          const r = DEMO_ROLES[key];
          return (
            <a key={key} href={`/demo/${key}`} className="card-link flex items-center gap-3 p-4">
              <span className={`badge ${tint[key]}`}>{r.label}</span>
              <span className="text-sm"><b>{r.who}</b><span className="block text-xs muted">{r.pitch}</span></span>
            </a>
          );
        })}
      </div>

      <p className="text-center text-xs muted">
        Built with Next.js, Supabase (row-level security), the Vercel AI SDK with Groq, and Stripe (test mode) ·{" "}
        <a href="https://github.com/jaineel132/CampusAI" className="link">Code &amp; README</a>
      </p>
    </main>
  );
}
