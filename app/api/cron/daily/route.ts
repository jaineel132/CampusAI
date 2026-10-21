import { runReminders } from "@/lib/jobs";

export const maxDuration = 60;

// Vercel Cron sends "Authorization: Bearer $CRON_SECRET"; anything else is refused.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  return Response.json({ reminders: await runReminders() });
}
