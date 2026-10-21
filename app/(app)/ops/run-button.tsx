"use client";

import { useFormStatus } from "react-dom";

export function RunDigestButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
      {pending ? "Ops agent is working…" : "Run digest now"}
    </button>
  );
}
