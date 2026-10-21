import Link from "next/link";
import { getMe, type Role } from "@/lib/supabase";
import { signOut } from "@/app/actions";

// Add a link here when its page exists (PRD: no button that does nothing).
const nav: Record<Role, { href: string; label: string }[]> = {
  student: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/courses", label: "Courses" },
    { href: "/assignments", label: "Assignments" },
    { href: "/fees", label: "Fees & payments" },
  ],
  professor: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/courses", label: "My courses" },
    { href: "/assignments", label: "Assignments & submissions" },
  ],
  admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/fees", label: "Fees overview" },
  ],
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await getMe();
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-gray-200 bg-white p-4 md:w-56 md:border-r md:border-b-0">
        <p className="font-semibold">CampusOS</p>
        <p className="text-xs text-gray-500">{me.institution.name}</p>
        <nav className="mt-4 flex gap-2 md:flex-col">
          {nav[me.role].map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-2 py-1 text-sm hover:bg-gray-100">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 text-sm md:mt-8">
          <p>{me.full_name}</p>
          <p className="text-xs capitalize text-gray-500">{me.role}</p>
          <form action={signOut}>
            <button className="mt-2 text-xs text-gray-500 underline">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
