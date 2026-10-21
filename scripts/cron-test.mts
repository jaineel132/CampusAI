// Calls the cron routes like Vercel does. Run with the app running, right after `npm run seed`:
//   npm run test:cron [baseUrl]
import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://localhost:3000";
const call = (path: string, auth = true) =>
  fetch(base + path, { headers: auth ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {} });

assert.equal((await call("/api/cron/daily", false)).status, 401, "cron refuses requests without the secret");

type R = { assignment_reminders: number; fee_reminders: number; new: number };
const first: R[] = (await (await call("/api/cron/daily")).json()).reminders;
const second: R[] = (await (await call("/api/cron/daily")).json()).reminders;
// Seed: Northfield has 1 unsubmitted assignment due in 48 h (Aarav) + 2 fees due in 7 days; Lakeside nothing due soon.
assert.deepEqual(first.map((r) => [r.assignment_reminders, r.fee_reminders]).sort(), [[0, 0], [1, 2]], "reminders match seeded deadlines");
assert.ok(second.every((r) => r.new === 0), "re-running the same day creates no duplicates");

const weekly = (await (await call("/api/cron/weekly")).json()).digests as { ok: boolean }[];
assert.ok(weekly.length === 2 && weekly.every((d) => d.ok), "ops digest generated for both colleges");
console.log("✓ cron test passed");
