import "server-only";
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Tag on every Kibo checkout (internal id, kept as "campusos"). This Stripe account is shared with another app,
// so the webhook ignores any session without it.
export const APP_TAG = "campusos";
