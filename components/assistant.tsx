"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";

type Passage = { document_id: string; title: string; page: number };

const suggestions: Record<string, string[]> = {
  student: ["What's due this week?", "What do I owe in fees?", "Explain 3NF from our notes"],
  professor: ["Which assignments are due soon?", "How many submissions do I have?"],
  admin: ["Which fees are still unpaid?"],
};

// Renders the bits of markdown the model uses: **bold**, `code`, *italics*, and in-app links like /fees.
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\/(?:assignments|courses|fees|dashboard)[\w/-]*)/g).map((t, i) =>
    t.startsWith("/") ? <a key={i} href={t} className="link">{t.startsWith("/assignments/") ? "Open assignment" : t}</a>
    : t.startsWith("**") ? <strong key={i}>{t.slice(2, -2)}</strong>
    : t.startsWith("`") ? <code key={i} className="rounded border border-line bg-canvas px-1 font-mono text-xs">{t.slice(1, -1)}</code>
    : t.startsWith("*") && t.length > 2 ? <em key={i}>{t.slice(1, -1)}</em>
    : t
  );
}

// Side panel on every page. Messages persist while navigating because the layout stays mounted.
export function Assistant({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const path = usePathname();
  const { messages, sendMessage, status, error, regenerate } = useChat();
  const busy = status === "submitted" || status === "streaming";

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text }, { body: { path } });
    setInput("");
  };

  // One-click example questions elsewhere on the page (AskChip) open the panel and ask.
  // No deps on purpose: re-subscribes each render so `ask` always sees the current status and path.
  useEffect(() => {
    const onAsk = (e: Event) => {
      setOpen(true);
      ask((e as CustomEvent<string>).detail);
    };
    window.addEventListener("campusai:ask", onAsk);
    return () => window.removeEventListener("campusai:ask", onAsk);
  });

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn fixed right-4 bottom-4 z-40 rounded-full px-5 py-3 shadow-lift">
        ✦ Ask CampusAI
      </button>
    );

  return (
    <aside aria-label="Assistant" className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-canvas sm:w-96">
      <div className="flex items-center justify-between bg-navy p-3 text-white">
        <p className="font-bold">✦ CampusAI Assistant</p>
        <button onClick={() => setOpen(false)} aria-label="Close assistant" className="btn-ghost btn-sm">✕</button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {!messages.length && (
          <div className="space-y-2">
            <p className="muted">Answers come from your records and course notes, with sources.</p>
            {(suggestions[role] ?? []).map((s) => (
              <button key={s} onClick={() => ask(s)} className="btn-ghost w-full justify-start text-left font-medium">{s}</button>
            ))}
          </div>
        )}

        {messages.map((m) => {
          const sources = m.parts.flatMap((p) =>
            p.type === "tool-search_course_notes" && p.state === "output-available" ? ((p.output as { passages?: Passage[] }).passages ?? []) : []
          );
          const unique = [...new Map(sources.map((s) => [`${s.document_id}:${s.page}`, s])).values()];
          return (
            <div key={m.id} className={`rounded-lg p-2 ${m.role === "user" ? "ml-8 bg-navy text-white" : "mr-4 border border-line bg-white shadow-card"}`}>
              {m.parts.map((p, i) =>
                p.type === "text" ? <p key={i} className="whitespace-pre-wrap"><Inline text={p.text} /></p>
                : p.type.startsWith("tool-") && "state" in p && p.state !== "output-available" ? (
                  <p key={i} className="text-xs muted">Looking up {p.type.slice(5).replaceAll("_", " ")}…</p>
                ) : null
              )}
              {m.role === "assistant" && unique.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {unique.map((s) => (
                    <a key={`${s.document_id}:${s.page}`} href={`/files/document/${s.document_id}#page=${s.page}`} target="_blank"
                      className="badge bg-info hover:underline">
                      {s.title}, p. {s.page}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {status === "submitted" && <p className="text-xs muted">Thinking…</p>}
        {error && (
          <div role="alert" className="rounded-lg border border-line bg-danger/30 p-2">
            The assistant is unavailable right now (AI provider error).{" "}
            <button onClick={() => regenerate()} className="link">Retry</button>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t border-line bg-white p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about deadlines, fees, notes…" aria-label="Message"
          className="field flex-1" />
        <button disabled={busy || !input.trim()} className="btn">Send</button>
      </form>
    </aside>
  );
}
