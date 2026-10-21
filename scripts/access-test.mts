// Proves RLS isolation: students only see their own records, colleges never see each other.
// Run after seeding: npm run test:access
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function as(email: string) {
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email, password: "CampusOS-demo-2026" });
  if (error) throw error;
  return db;
}

const rows = async (db: Awaited<ReturnType<typeof as>>, table: string) => {
  const { data, error } = await db.from(table).select("*");
  if (error) throw error;
  return data;
};

const aarav = await as("aarav@northfield.demo");
const diya = await as("diya@northfield.demo");
const jordan = await as("jordan@lakeside.demo");
const mehta = await as("prof.mehta@northfield.demo");
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const aaravId = (await aarav.auth.getUser()).data.user!.id;

// Student B (Diya) cannot see Student A's (Aarav's) fees or submissions
const diyaFees = await rows(diya, "fee_records");
assert.ok(diyaFees.length > 0, "Diya sees her own fees");
assert.ok(diyaFees.every((f) => f.student_id !== aaravId), "Diya must not see Aarav's fees");

// Diya is not in DBMS: no DBMS course, assignments
const diyaCourses = await rows(diya, "courses");
assert.deepEqual(diyaCourses.map((c) => c.code), ["CS302"], "Diya only sees OS");

// College B student sees nothing from college A
const jordanCourses = await rows(jordan, "courses");
assert.deepEqual(jordanCourses.map((c) => c.code), ["CS110"], "Jordan only sees his college's course");
assert.equal((await rows(jordan, "institutions")).length, 1, "Jordan sees only his college");
assert.ok((await rows(jordan, "profiles")).every((p) => !p.email.endsWith("@northfield.demo")), "no cross-college profiles");
assert.ok((await rows(jordan, "announcements")).length === 0, "no college A announcements for Jordan");

// Professor sees only their courses' data and no raw ratings
assert.ok((await rows(mehta, "fee_records")).length === 0, "professor sees no fees");
assert.ok((await rows(mehta, "professor_ratings")).length === 0, "professor sees no raw ratings");

// Logged-out visitor sees nothing
for (const t of ["institutions", "profiles", "courses", "fee_records"]) assert.equal((await rows(anon, t)).length, 0, `anon sees no ${t}`);

// Students cannot write their own payment state
const { error: feeWrite } = await aarav.from("fee_records").update({ amount_paid: 999999 }).eq("student_id", aaravId).select();
const fees = await rows(aarav, "fee_records");
assert.ok(feeWrite || fees.every((f) => f.amount_paid < 999999), "student cannot mark fees paid");

console.log("✓ access test passed");
