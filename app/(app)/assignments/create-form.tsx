"use client";

import { useActionState } from "react";
import { createAssignment } from "./actions";
import { DueInput } from "@/components/due-input";

const field = "field";

export function CreateAssignmentForm({ courses }: { courses: { id: string; code: string; name: string }[] }) {
  const [error, action, pending] = useActionState(createAssignment, null);
  return (
    <form action={action} className="space-y-3 card p-5">
      <h2 className="section-title">New assignment</h2>
      <label className="block text-sm">Course
        <select name="course_id" required className={field}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
      </label>
      <label className="block text-sm">Title<input name="title" required className={field} /></label>
      <label className="block text-sm">Instructions<textarea name="instructions" required rows={3} className={field} /></label>
      <label className="block text-sm">Rubric (one item per line)<textarea name="rubric" required rows={3} className={field} /></label>
      <div className="text-sm">Deadline<DueInput name="due_at" /></div>
      {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
      <button disabled={pending} className="btn">
        {pending ? "Creating…" : "Create assignment"}
      </button>
    </form>
  );
}
