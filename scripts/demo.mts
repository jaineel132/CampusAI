// Fills the freshly seeded demo with real agent output (uploads, pre-checks, feedback, ratings, reminders, reports, plans).
// Run: npm run dev (in another terminal), then npm run demo. Pass a URL to target another running app.
const base = process.argv[2] ?? "http://localhost:3000";
console.log(`Running the agents on the demo data via ${base} (takes a few minutes; it pauses between AI calls)…`);
const res = await fetch(`${base}/api/demo/populate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
const body = await res.json().catch(() => ({ error: res.statusText }));
if (!res.ok || body.error) {
  console.error("Demo setup failed:", body.error ?? res.status);
  process.exit(1);
}
for (const s of body.steps as { step: string; ok: boolean }[]) console.log(`${s.ok ? "✓" : "✗"} ${s.step}`);
console.log(body.ok ? "Demo ready." : "Some steps failed (usually the AI rate limit): run npm run demo again in a minute.");
process.exit(body.ok ? 0 : 1);
