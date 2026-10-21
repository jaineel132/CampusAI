"use client";

import { useFormStatus } from "react-dom";

const solid = "rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

// Submit button for server-action forms: disabled and relabelled while the server works,
// so a slow save never looks like nothing happened.
export function SubmitButton({ children, pending: busy, className = solid }: { children: React.ReactNode; pending: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className}>
      {pending ? busy : children}
    </button>
  );
}
