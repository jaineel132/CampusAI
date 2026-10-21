"use client";

import { useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

// datetime-local has no timezone; convert to ISO in the browser so the server stores the right instant.
// The server snapshot is empty, so a prefilled value is converted only once the page runs in the browser.
export function DueInput({ name, defaultValue = "", required = true }: { name: string; defaultValue?: string; required?: boolean }) {
  const [local, setLocal] = useState(defaultValue);
  const iso = useSyncExternalStore(noSubscribe, () => (local ? new Date(local).toISOString() : ""), () => "");
  return (
    <>
      <input type="datetime-local" required={required} aria-label="Deadline" value={local} onChange={(e) => setLocal(e.target.value)}
        className="field" />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}
