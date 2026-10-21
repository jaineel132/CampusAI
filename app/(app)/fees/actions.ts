"use server";

import { redirect } from "next/navigation";
import { createClient, getMe } from "@/lib/supabase";
import { APP_TAG, stripe } from "@/lib/stripe";

// Opens Stripe Checkout (test mode) for the remaining balance of one fee.
// It never marks anything paid: only the verified webhook does that.
export async function startCheckout(feeId: string) {
  const me = await getMe();
  if (me.role !== "student") return;
  const db = await createClient();
  const { data: fee } = await db
    .from("fee_records")
    .select("id, description, term, amount_due, amount_paid")
    .eq("id", feeId)
    .eq("student_id", me.id) // RLS already enforces this; explicit for clarity
    .maybeSingle();
  if (!fee) return;
  const balance = fee.amount_due - fee.amount_paid;
  if (balance <= 0) return;

  const base = process.env.NEXT_PUBLIC_APP_URL;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: me.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: me.institution.currency.toLowerCase(),
        unit_amount: Math.round(balance * 100),
        product_data: { name: `${fee.description} · ${fee.term}`, description: me.institution.name },
      },
    }],
    metadata: { app: APP_TAG, fee_record_id: fee.id, student_id: me.id, institution_id: me.institution.id },
    success_url: `${base}/fees?paid=1`,
    cancel_url: `${base}/fees`,
  });
  redirect(session.url!);
}
