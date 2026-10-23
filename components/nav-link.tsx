"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar link on the navy sidebar; the current section is highlighted with a gold edge.
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const here = usePathname().startsWith(href);
  return (
    <Link href={href} aria-current={here ? "page" : undefined}
      className={`flex items-center justify-between gap-2 rounded-lg border-l-4 px-3 py-2 text-sm font-medium transition ${
        here ? "border-gold bg-white/15 text-white" : "border-transparent text-white/75 hover:bg-white/10 hover:text-white"
      }`}>
      {children}
    </Link>
  );
}
