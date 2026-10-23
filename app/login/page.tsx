"use client";

import { useActionState, useState } from "react";
import { signIn } from "@/app/actions";

const DEMO_PASSWORD = "CampusAI-demo-2026";
const demoAccounts = [
  { label: "Student — Aarav (Northfield)", email: "aarav@northfield.demo", colour: "bg-info" },
  { label: "Student B — Diya (Northfield)", email: "diya@northfield.demo", colour: "bg-info" },
  { label: "Professor — Dr. Mehta (Northfield)", email: "prof.mehta@northfield.demo", colour: "bg-ai" },
  { label: "Admin — Rohan (Northfield)", email: "admin@northfield.demo", colour: "bg-ok" },
  { label: "Student — Jordan (Lakeside, US)", email: "jordan@lakeside.demo", colour: "bg-info" },
];

export default function LoginPage() {
  const [error, action, pending] = useActionState(signIn, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-navy">Campus<span className="text-gold">AI</span></h1>
          <p className="mt-4 text-sm font-medium muted">One college app. AI agents do the busywork.</p>
        </div>

        <form action={action} className="card space-y-3 p-5">
          <label className="block text-sm">
            Email
            <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="field mt-1" />
          </label>
          <label className="block text-sm">
            Password
            <input name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="field mt-1" />
          </label>
          {error && <p role="alert" className="text-sm text-danger-ink">{error}</p>}
          <button disabled={pending} className="btn w-full">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide">Demo accounts (click to fill)</p>
          {demoAccounts.map((a) => (
            <button key={a.email} type="button" onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); }}
              className={`btn-ghost w-full justify-start text-left ${a.colour}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
