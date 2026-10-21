"use client";

import { useState } from "react";
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
    t.startsWith("/") ? <a key={i} href={t} className="text-blue-700 underline">{t.startsWith("/assignments/") ? "Open assignment" : t}</a>
    : t.startsWith("**") ? <strong key={i}>{t.slice(2, -2)}</strong>
    : t.startsWith("`") ? <code key={i} className="rounded bg-gray-100 px-1">{t.slice(1, -1)}</code>
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

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="fixed right-4 bottom-4 z-40 rounded-full bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
        Ask CampusOS
      </button>
    );

  return (
    <aside aria-label="Assistant" className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-gray-200 bg-white shadow-xl sm:w-96">
      <div className="flex items-center justify-between border-b border-gray-200 p-3">
        <p className="font-medium">Campus Assistant</p>
        <button onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded px-2 text-gray-500 hover:bg-gray-100">✕</button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {!messages.length && (
          <div className="space-y-2">
            <p className="text-gray-500">Answers come from your records and course notes, with sources.</p>
            {(suggestions[role] ?? []).map((s) => (
              <button key={s} onClick={() => ask(s)} className="block w-full rounded-md border border-gray-200 px-3 py-2 text-left hover:bg-gray-50">{s}</button>
            ))}
          </div>
        )}

        {messages.map((m) => {
          const sources = m.parts.flatMap((p) =>
            p.type === "tool-search_course_notes" && p.state === "output-available" ? ((p.output as { passages?: Passage[] }).passages ?? []) : []
          );
          const unique = [...new Map(sources.map((s) => [`${s.document_id}:${s.page}`, s])).values()];
          return (
            <div key={m.id} className={m.role === "user" ? "ml-8 rounded-lg bg-gray-100 p-2" : "mr-4"}>
              {m.parts.map((p, i) =>
                p.type === "text" ? <p key={i} className="whitespace-pre-wrap"><Inline text={p.text} /></p>
                : p.type.startsWith("tool-") && "state" in p && p.state !== "output-available" ? (
                  <p key={i} className="text-xs text-gray-400">Looking up {p.type.slice(5).replaceAll("_", " ")}…</p>
                ) : null
              )}
              {m.role === "assistant" && unique.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {unique.map((s) => (
                    <a key={`${s.document_id}:${s.page}`} href={`/files/document/${s.document_id}#page=${s.page}`} target="_blank"
                      className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-800 hover:underline">
                      {s.title}, p. {s.page}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {status === "submitted" && <p className="text-xs text-gray-400">Thinking…</p>}
        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-2 text-red-700">
            The assistant is unavailable right now (AI provider error).{" "}
            <button onClick={() => regenerate()} className="underline">Retry</button>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t border-gray-200 p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about deadlines, fees, notes…" aria-label="Message"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <button disabled={busy || !input.trim()} className="rounded-md bg-gray-900 px-3 text-sm text-white disabled:opacity-50">Send</button>
      </form>
    </aside>
  );
}
