import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { DEMO_PASSWORD, DEMO_ROLES, type DemoRole } from "@/lib/demo";

// "Explore as …": signs in as that role's demo account on the server, so no one types a password.
export async function GET(req: NextRequest, ctx: RouteContext<"/demo/[role]">) {
  const { role } = await ctx.params;
  const demo = DEMO_ROLES[role as DemoRole];
  if (!demo) return NextResponse.redirect(new URL("/", req.url));

  const db = await createClient();
  await db.auth.signOut();
  const { error } = await db.auth.signInWithPassword({ email: demo.email, password: DEMO_PASSWORD });
  return NextResponse.redirect(new URL(error ? "/?error=demo" : "/dashboard", req.url));
}
