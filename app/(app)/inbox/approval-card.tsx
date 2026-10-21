"use client";

import { useActionState } from "react";
import { DueInput } from "@/components/due-input";
import { decide } from "./actions";

const field = "field mt-1";

export type EditableField = { name: string; label: string; value: string; rows?: number; due?: boolean };

// Approve / Edit / Reject. Edits live in a native <details>; their values are sent with Approve.
export function ApprovalActions({ id, editable, open = false }: { id: string; editable: EditableField[]; open?: boolean }) {
  const [error, action, pending] = useActionState(decide.bind(null, id), null);
  return (
    <form action={action} className="space-y-2">
      {editable.length > 0 && (
        <details open={open} className="text-sm">
          <summary className="cursor-pointer font-semibold underline decoration-2">Edit before approving</summary>
          <div className="mt-2 space-y-2">
            {editable.map((f) => (
              <label key={f.name} className="block">
                {f.label}
                {f.due ? (
                  <DueInput name={f.name} defaultValue={f.value} required={false} />
                ) : f.rows ? (
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
        <button name="decision" value="approve" disabled={pending} className="btn bg-mint">
          {pending ? "Working…" : "Approve"}
        </button>
        <button name="decision" value="reject" disabled={pending} className="btn-ghost">
          Reject
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
    </form>
  );
}
