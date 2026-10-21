// Sends signed fake Stripe events to the webhook. Run with the app running: npm run test:webhook [baseUrl]
// Uses Diya's part-paid tuition fee. Run `npm run seed` afterwards to reset.
import assert from "node:assert/strict";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const base = process.argv[2] ?? "http://localhost:3000";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: diya } = await db.from("profiles").select("id").eq("email", "diya@northfield.demo").single();
const { data: fee } = await db.from("fee_records").select("id, amount_paid, amount_due").eq("student_id", diya!.id).eq("description", "Tuition fee").single();
const before = fee!.amount_paid;

const session = (id: string, app = "campusos") => ({
  id: `evt_test_${id}`, object: "event", type: "checkout.session.completed",
  data: { object: { id, object: "checkout.session", payment_status: "paid", amount_total: 500000, currency: "inr", payment_intent: null, metadata: { app, fee_record_id: fee!.id } } },
});
const send = async (event: object, secret = process.env.STRIPE_WEBHOOK_SECRET!) => {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(`${base}/api/stripe/webhook`, { method: "POST", body: payload, headers: { "stripe-signature": signature } });
  return { status: res.status, body: await res.text() };
};
const paid = async () => (await db.from("fee_records").select("amount_paid").eq("id", fee!.id).single()).data!.amount_paid;

const sid = `cs_test_${Date.now()}`;
assert.equal((await send(session(sid), "whsec_forged")).status, 400, "forged signature rejected");
assert.match((await send(session(`${sid}_x`, "verdant"))).body, /other app/, "other app's payments ignored");
assert.equal(await paid(), before, "nothing recorded yet");

assert.match((await send(session(sid))).body, /"recorded":true/, "payment recorded");
assert.equal(await paid(), before + 5000, "₹5,000 added to amount_paid");
assert.match((await send(session(sid))).body, /"recorded":false/, "replayed event ignored");
assert.equal(await paid(), before + 5000, "replay did not double-count");

console.log(`✓ webhook test passed (Diya's fee: ₹${before} → ₹${before + 5000})`);
