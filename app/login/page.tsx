"use client";

import { useActionState, useState } from "react";
import { signIn } from "@/app/actions";

const DEMO_PASSWORD = "CampusOS-demo-2026";
const demoAccounts = [
  { label: "Student — Aarav (Northfield)", email: "aarav@northfield.demo" },
  { label: "Student B — Diya (Northfield)", email: "diya@northfield.demo" },
  { label: "Professor — Dr. Mehta (Northfield)", email: "prof.mehta@northfield.demo" },
  { label: "Admin — Rohan (Northfield)", email: "admin@northfield.demo" },
  { label: "Student — Jordan (Lakeside, US)", email: "jordan@lakeside.demo" },
];

export default function LoginPage() {
  const [error, action, pending] = useActionState(signIn, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">CampusOS</h1>
          <p className="text-sm text-gray-500">Sign in to your college</p>
        </div>

        <form action={action} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <label className="block text-sm">
            Email
            <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            Password
            <input name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button disabled={pending} className="w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white disabled:opacity-50">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-gray-500">Demo accounts (click to fill)</p>
          {demoAccounts.map((a) => (
            <button key={a.email} type="button" onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); }}
              className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:bg-gray-100">
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
