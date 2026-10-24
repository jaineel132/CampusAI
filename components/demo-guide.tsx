import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { DEMO_ROLES, demoRoleFor } from "@/lib/demo";
import { Disclosure } from "@/components/disclosure";
import { AskChip } from "@/components/ask-chip";

// Demo mode: what the AI agents already did for this role, one agent per row, each opening the page that shows it.
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
    <Disclosure open className="card border-ai-ink/20 bg-ai/30 p-4"
      title={<h2 className="section-title">What the AI agents did for {r.name}</h2>}
      meta={<span className="text-xs muted">Demo · already done</span>}>
      <p className="text-sm text-ink/80">
        You&apos;re viewing the demo as <b>{r.name}, {r.as}</b>. Each row is real work an agent already did. Open it to see the result.
      </p>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
        {r.look.map((l) => {
          const to = href(l);
          return (
            <li key={l.did} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-3">
              <span className="sticker shrink-0 self-start sm:w-40 sm:self-center">✦ {l.agent}</span>
              <span className="flex-1">{l.did}</span>
              {to && <Link href={to} className="link shrink-0 text-xs">Open →</Link>}
            </li>
          );
        })}
        <li className="flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-3">
          <span className="sticker shrink-0 self-start sm:w-40 sm:self-center">✦ Assistant</span>
          <span className="flex flex-1 flex-wrap items-center gap-2">
            <span className="muted">Click to ask:</span>
            {r.ask.map((q) => <AskChip key={q} text={q} />)}
          </span>
        </li>
      </ul>
    </Disclosure>
  );
}
