"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES } from "@/lib/format";

type Ticket = { bucket: string; path: string; token: string } | { error: string };

// Browser → Supabase Storage via a one-time signed URL (Vercel caps request bodies at 4.5 MB).
// start() checks permissions and issues the ticket; finish() verifies the file and saves the row.
export function FileUpload(props: {
  start: (fileName: string) => Promise<Ticket>;
  finish: (path: string, fileName: string) => Promise<{ error?: string }>;
  label: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<{ status: "idle" | "uploading" | "saving" | "done" | "error"; message?: string }>({ status: "idle" });
  const busy = state.status === "uploading" || state.status === "saving";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = new FormData(form).get("file") as File | null;
    if (!file?.size) return setState({ status: "error", message: "Choose a file first." });
    if (!UPLOAD_TYPES.includes(file.type)) return setState({ status: "error", message: "Only PDF or TXT files." });
    if (file.size > MAX_UPLOAD_BYTES) return setState({ status: "error", message: "File is over 10 MB." });

    setState({ status: "uploading" });
    const ticket = await props.start(file.name);
    if ("error" in ticket) return setState({ status: "error", message: ticket.error });

    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).storage;
    const { error } = await storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
    if (error) return setState({ status: "error", message: `Upload failed: ${error.message}` });

    setState({ status: "saving" });
    const saved = await props.finish(ticket.path, file.name);
    if (saved.error) return setState({ status: "error", message: saved.error });
    setState({ status: "done", message: "Saved." });
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="file" name="file" accept=".pdf,.txt,application/pdf,text/plain" aria-label={props.label} disabled={busy}
        className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-2 file:border-ink file:bg-white file:px-3 file:py-1.5 file:font-semibold hover:file:bg-cream" />
      <button disabled={busy} className="btn">
        {state.status === "uploading" ? "Uploading…" : state.status === "saving" ? "Saving…" : props.label}
      </button>
      {state.message && (
        <p role="status" className={`text-sm ${state.status === "error" ? "text-danger-ink" : "text-ok-ink"}`}>{state.message}</p>
      )}
    </form>
  );
}
