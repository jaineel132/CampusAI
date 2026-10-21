import Link from "next/link";
import { createClient, getMe, type Role } from "@/lib/supabase";
import { signOut } from "@/app/actions";
import { Assistant } from "@/components/assistant";
import { SubmitButton } from "@/components/submit-button";

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
      <aside className="border-b border-gray-200 bg-white p-4 md:w-56 md:border-r md:border-b-0">
        <p className="font-semibold">CampusOS</p>
        <p className="text-xs text-gray-500">{me.institution.name}</p>
        <nav className="mt-4 flex flex-wrap gap-2 md:flex-col">
          {nav[me.role].map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-2 py-1 text-sm hover:bg-gray-100">
              {l.label}
              {l.href === "/inbox" && !!inbox && <span className="ml-1 rounded-full bg-violet-600 px-1.5 text-xs text-white">{inbox}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-4 text-sm md:mt-8">
          <p>{me.full_name}</p>
          <p className="text-xs capitalize text-gray-500">{me.role}</p>
          <form action={signOut}>
            <SubmitButton pending="Signing out…" className="mt-2 text-xs text-gray-500 underline">Sign out</SubmitButton>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 pb-20 md:p-8">{children}</main>
      <Assistant role={me.role} />
    </div>
  );
}
