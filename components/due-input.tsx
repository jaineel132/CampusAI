"use client";

import { useState } from "react";

// datetime-local has no timezone; convert to ISO in the browser so the server stores the right instant.
export function DueInput({ name }: { name: string }) {
  const [iso, setIso] = useState("");
  return (
    <>
      <input type="datetime-local" required aria-label="Deadline" onChange={(e) => setIso(e.target.value ? new Date(e.target.value).toISOString() : "")}
        className="w-full rounded-md border border-gray-300 px-3 py-2" />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}
