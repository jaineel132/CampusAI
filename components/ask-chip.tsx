"use client";

// One-click example question: opens the assistant and asks it (the Assistant listens for this event).
export function AskChip({ text }: { text: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("campusai:ask", { detail: text }))}
      className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-navy shadow-card transition hover:border-navy/40 hover:bg-canvas">
      “{text}”
    </button>
  );
}
