import { createServiceClient } from "@/lib/supabase";
import { runOpsDigest } from "@/lib/jobs";

export const maxDuration = 120;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const { data: colleges } = await createServiceClient().from("institutions").select("id");
  const digests = [];
  for (const c of colleges ?? []) digests.push({ institution: c.id, ok: (await runOpsDigest(c.id, "schedule")).ok });
  return Response.json({ digests });
}
