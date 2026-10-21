import { createClient, getMe, type Role } from "@/lib/supabase";
import { signOut } from "@/app/actions";
import { Assistant } from "@/components/assistant";
import { SubmitButton } from "@/components/submit-button";
import { NavLink } from "@/components/nav-link";

const roleColour: Record<Role, string> = { student: "bg-yellow", professor: "bg-pink", admin: "bg-mint" };

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
    { href: "/ops", label: "Ops digest" },
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
      <aside className="border-b-2 border-ink bg-cream p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-r-2 md:border-b-0">
        <p className="inline-block -rotate-2 rounded-md border-2 border-ink bg-yellow px-2 py-0.5 text-xl font-bold tracking-tight shadow-brutal-sm">CampusOS</p>
        <p className="mt-2 text-xs font-medium muted">{me.institution.name}</p>
        <nav className="mt-5 flex flex-wrap gap-1.5 md:flex-col">
          {nav[me.role].map((l) => (
            <NavLink key={l.href} href={l.href} active={roleColour[me.role]}>
              {l.label}
              {l.href === "/inbox" && !!inbox && <span className="badge bg-pink">{inbox}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="card mt-5 p-3 text-sm md:mt-8">
          <p className="font-bold">{me.full_name}</p>
          <span className={`badge mt-1 capitalize ${roleColour[me.role]}`}>{me.role}</span>
          <form action={signOut}>
            <SubmitButton pending="Signing out…" className="btn-ghost btn-sm mt-3 w-full">Sign out</SubmitButton>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 pb-24 md:p-8">{children}</main>
      <Assistant role={me.role} />
    </div>
  );
}
