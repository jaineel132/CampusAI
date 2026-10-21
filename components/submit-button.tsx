"use client";

import { useFormStatus } from "react-dom";

// Submit button for server-action forms: disabled and relabelled while the server works,
// so a slow save never looks like nothing happened.
export function SubmitButton({ children, pending: busy, className = "btn" }: { children: React.ReactNode; pending: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className}>
      {pending ? busy : children}
    </button>
  );
}
