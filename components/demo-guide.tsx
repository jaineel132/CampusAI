import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { DEMO_ROLES, demoRoleFor } from "@/lib/demo";
import { Disclosure } from "@/components/disclosure";

// Demo mode: "what to look at" for the current role, each item linking straight to the page that shows it.
export async function DemoGuide({ email }: { email: string }) {
  const role = demoRoleFor(email);
  if (!role) return null;
  const r = DEMO_ROLES[role];

  // Assignment ids change on every demo reset, so resolve them by title (RLS: only ones this user can see).
  const titles = r.look.flatMap((l) => (l.assignment ? [l.assignment] : []));
  const { data } = titles.length
    ? await (await createClient()).from("assignments").select("id, title").in("title", titles)
    : { data: [] };
  const idOf = new Map((data ?? []).map((a) => [a.title, a.id]));
  const href = (l: (typeof r.look)[number]) =>
    l.assignment ? (idOf.has(l.assignment) ? `/assignments/${idOf.get(l.assignment)}` : "/assignments") : l.href;

  return (
    <Disclosure open className="card border-ai-ink/20 bg-ai/40 p-4"
      title={<h2 className="section-title">What to look at as {r.label === "Other college" ? "a student at another college" : `the ${r.label.toLowerCase()}`}</h2>}
      meta={<span className="text-xs muted">Already filled in by the agents</span>}>
      <ul className="space-y-1.5 text-sm">
        {r.look.map((l) => {
          const to = href(l);
          return (
            <li key={l.text} className="flex gap-2">
              <span aria-hidden className="text-ai-ink">✦</span>
              {to ? <Link href={to} className="link">{l.text}</Link> : <span>{l.text}</span>}
            </li>
          );
        })}
      </ul>
    </Disclosure>
  );
}
