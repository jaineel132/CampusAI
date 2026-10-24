// Fills the freshly seeded demo with real agent output (uploads, pre-checks, feedback, drafts, ratings, reminders, reports, plans).
// Run: npm run dev (in another terminal), then npm run demo. Pass a URL to target another running app.
const base = process.argv[2] ?? "http://localhost:3000";
console.log(`Running the agents on the demo data via ${base} (about 5 minutes; it pauses between AI calls)…`);
const res = await fetch(`${base}/api/demo/populate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
if (!res.ok || !res.body) {
  console.error("Demo setup failed:", res.status, await res.text());
  process.exit(1);
}

// The route streams one line per finished step, then a final JSON summary.
let buffer = "", last = "";
const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
for (let r = await reader.read(); !r.done; r = await reader.read()) {
  buffer += r.value;
  const lines = buffer.split("\n");
  buffer = lines.pop()!;
  for (const line of lines) {
    if (line.startsWith("{")) last = line;
    else if (line) console.log(line);
  }
}
const summary = JSON.parse(last || buffer || "{}");
if (summary.error) {
  console.error("Demo setup failed:", summary.error);
  process.exit(1);
}
console.log(summary.ok ? "Demo ready." : "Some steps failed (usually the AI rate limit): run npm run demo again in a minute.");
process.exit(summary.ok ? 0 : 1);
