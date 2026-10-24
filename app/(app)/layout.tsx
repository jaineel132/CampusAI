import Link from "next/link";
import { createClient, getMe, type Role } from "@/lib/supabase";
import { Assistant } from "@/components/assistant";
import { NavLink } from "@/components/nav-link";
import { MobileMenu } from "@/components/mobile-menu";
import { DEMO_ROLES, type DemoRole } from "@/lib/demo";

const roleColour: Record<Role, string> = { student: "bg-info", professor: "bg-ai", admin: "bg-ok" };

// Add a link here when its page exists (PRD: no button that does nothing).
const nav: Record<Role, { href: string; label: string }[]> = {
  student: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/courses", label: "Courses & materials" },
    { href: "/assignments", label: "Assignments" },
    { href: "/fees", label: "Fees & payments" },
    { href: "/ratings", label: "Rate professors" },
  ],
  professor: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/courses", label: "My courses & uploads" },
    { href: "/assignments", label: "Assignments & submissions" },
    { href: "/inbox", label: "Approval inbox" },
    { href: "/ratings", label: "Ratings & themes" },
    { href: "/announcements", label: "Announcements" },
  ],
  admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/ops", label: "Weekly report" },
    { href: "/fees", label: "Fees overview" },
    { href: "/inbox", label: "Approval inbox" },
    { href: "/ratings", label: "Ratings & themes" },
    { href: "/announcements", label: "Announcements" },
  ],
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await getMe();
  // RLS scopes the count to items this reviewer can act on.
  const { count: inbox } = me.role === "student"
    ? { count: 0 }
    : await (await createClient()).from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending");
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="bg-navy p-4 text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto">
        <MobileMenu brand={<>
          <p className="text-xl font-bold tracking-tight">Campus<span className="text-gold">AI</span></p>
          <p className="mt-1 text-xs text-white/60">{me.institution.name}</p>
        </>}>
        <nav className="mt-5 flex flex-col gap-1.5">
          {nav[me.role].map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
              {l.href === "/inbox" && !!inbox && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-navy">{inbox}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-5 rounded-xl bg-white/10 p-3 text-sm md:mt-8">
          <p className="font-semibold">{me.full_name}</p>
          <span className={`badge mt-1 capitalize ${roleColour[me.role]}`}>{me.role}</span>
          <Link href="/" className="mt-3 block text-xs text-white/70 underline hover:text-white">← All demo roles</Link>
        </div>
        </MobileMenu>
      </aside>
      <main className="min-w-0 flex-1 p-4 pb-24 md:p-8">
        {/* Demo mode: switch roles in one click, no login. Plain <a> so nothing prefetches a sign-in. */}
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-card">
          <span className="sticker">Demo</span>
          <span className="muted">Viewing as <b className="text-ink">{me.full_name}</b> · switch to</span>
          {(Object.keys(DEMO_ROLES) as DemoRole[]).map((key) => (
            <a key={key} href={`/demo/${key}`} aria-current={DEMO_ROLES[key].email === me.email ? "true" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                DEMO_ROLES[key].email === me.email ? "bg-navy text-white" : "bg-canvas text-ink hover:bg-line"
              }`}>
              {DEMO_ROLES[key].label}
            </a>
          ))}
        </div>
        {children}
      </main>
      <Assistant role={me.role} />
    </div>
  );
}
