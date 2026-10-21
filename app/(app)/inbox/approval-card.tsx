"use client";

import { useActionState } from "react";
import { decide } from "./actions";

const field = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

// Approve / Edit / Reject. Edits live in a native <details>; their values are sent with Approve.
export function ApprovalActions({ id, editable }: { id: string; editable: { name: string; label: string; value: string; rows?: number }[] }) {
  const [error, action, pending] = useActionState(decide.bind(null, id), null);
  return (
    <form action={action} className="space-y-2">
      {editable.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600 underline">Edit before approving</summary>
          <div className="mt-2 space-y-2">
            {editable.map((f) => (
              <label key={f.name} className="block">
                {f.label}
                {f.rows ? (
                  <textarea name={f.name} defaultValue={f.value} rows={f.rows} className={field} />
                ) : (
                  <input name={f.name} defaultValue={f.value} className={field} />
                )}
              </label>
            ))}
          </div>
        </details>
      )}
      <div className="flex gap-2">
        <button name="decision" value="approve" disabled={pending} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Working…" : "Approve"}
        </button>
        <button name="decision" value="reject" disabled={pending} className="rounded-md border border-gray-300 px-4 py-2 text-sm disabled:opacity-50">
          Reject
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
