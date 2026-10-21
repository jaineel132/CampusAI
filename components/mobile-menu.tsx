"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

// On phones the sidebar folds behind a Menu button; on wider screens it is always open.
// The menu remembers which page it was opened on, so it closes by itself after navigating.
export function MobileMenu({ brand, children }: { brand: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>{brand}</div>
        <button type="button" onClick={() => setOpenOn(open ? null : path)} aria-expanded={open} aria-controls="app-menu" className="btn-ghost btn-sm md:hidden">
          {open ? "✕ Close" : "☰ Menu"}
        </button>
      </div>
      <div id="app-menu" className={`${open ? "block" : "hidden"} md:block`}>{children}</div>
    </>
  );
}
