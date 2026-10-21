"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/supabase";
import { plannerAgent } from "@/lib/agents";

export async function refreshPlan() {
  const me = await getMe();
  if (me.role !== "student") return;
  after(() => plannerAgent(me.id));
  revalidatePath("/dashboard");
}
