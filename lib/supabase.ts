import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Acts as the logged-in user: every query goes through RLS.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component: proxy.ts refreshes the session instead
        }
      },
    },
  });
}

// Bypasses RLS. Only for webhooks, cron and background agent jobs.
export function createServiceClient() {
  return createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export type Role = "student" | "professor" | "admin";

export type Me = {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  institution: { id: string; name: string; currency: string; term_type: string; grading_scale: string; current_term: string };
};

// Current user + profile + college settings, once per request. Redirects to /login if signed out.
export const getMe = cache(async (): Promise<Me> => {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db
    .from("profiles")
    .select("id, role, full_name, email, institution:institutions(id, name, currency, term_type, grading_scale, current_term)")
    .eq("id", user.id)
    .single();
  if (!data) redirect("/login");
  return data as unknown as Me;
});
