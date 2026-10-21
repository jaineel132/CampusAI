import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase";

const kinds = {
  submission: { table: "submissions", bucket: "submissions" },
  document: { table: "documents", bucket: "materials" },
} as const;

// Opens a private file: RLS decides if the row is visible, then a 60-second signed URL is issued.
export async function GET(_req: NextRequest, ctx: RouteContext<"/files/[kind]/[id]">) {
  const { kind, id } = await ctx.params;
  const k = kinds[kind as keyof typeof kinds];
  if (!k) return new NextResponse("Not found", { status: 404 });

  const db = await createClient();
  const { data: row } = await db.from(k.table).select("file_path").eq("id", id).maybeSingle();
  if (!row) return new NextResponse("Not found", { status: 404 });

  const { data } = await createServiceClient().storage.from(k.bucket).createSignedUrl(row.file_path, 60);
  if (!data) return new NextResponse("File unavailable", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
