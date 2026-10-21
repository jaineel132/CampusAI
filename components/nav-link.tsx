"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar link; the current section is filled with the role's colour.
export function NavLink({ href, active, children }: { href: string; active: string; children: React.ReactNode }) {
  const here = usePathname().startsWith(href);
  return (
    <Link href={href} aria-current={here ? "page" : undefined}
      className={`flex items-center justify-between gap-2 rounded-md border-2 px-3 py-1.5 text-sm font-semibold transition-transform ${
        here ? `${active} border-ink shadow-brutal-sm` : "border-transparent hover:border-ink hover:bg-white"
      }`}>
      {children}
    </Link>
  );
}
