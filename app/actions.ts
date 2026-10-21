"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";

export async function signIn(_: string | null, form: FormData) {
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("password")),
  });
  if (error) return error.message;
  redirect("/dashboard");
}

export async function signOut() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/login");
}
