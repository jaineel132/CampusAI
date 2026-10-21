import type Stripe from "stripe";
import { APP_TAG, stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase";

// The ONLY writer of payments. Verifies Stripe's signature, then records the payment atomically
// (record_payment ignores replays of the same session).
export async function POST(req: Request) {
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") return Response.json({ ignored: event.type });
  const session = event.data.object;
  if (session.metadata?.app !== APP_TAG) return Response.json({ ignored: "other app" });
  if (session.payment_status !== "paid") return Response.json({ ignored: "not paid" });

  let receiptUrl: string | null = null;
  if (typeof session.payment_intent === "string") {
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ["latest_charge"] });
    receiptUrl = (pi.latest_charge as Stripe.Charge | null)?.receipt_url ?? null;
  }

  const { data: recorded, error } = await createServiceClient().rpc("record_payment", {
    p_fee_record_id: session.metadata.fee_record_id,
    p_amount: (session.amount_total ?? 0) / 100,
    p_currency: (session.currency ?? "").toUpperCase(),
    p_session_id: session.id,
    p_receipt_url: receiptUrl ?? "",
  });
  if (error) return new Response("Could not record payment", { status: 500 }); // Stripe retries
  return Response.json({ recorded });
}
