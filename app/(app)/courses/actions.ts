"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient, getMe } from "@/lib/supabase";
import { safeName } from "@/lib/format";
import { ingestDocument } from "@/lib/ingest";
import { materialsAgent } from "@/lib/agents";

const pathPrefix = (inst: string, courseId: string) => `${inst}/${courseId}/`;

// Step 1: only the course's professor gets a one-time upload URL.
export async function startMaterial(courseId: string, fileName: string) {
  const me = await getMe();
  const db = await createClient();
  const { data: course } = await db.from("courses").select("id").eq("id", courseId).eq("professor_id", me.id).maybeSingle();
  if (!course) return { error: "You can only upload to courses you teach." };

  const path = pathPrefix(me.institution.id, course.id) + `${crypto.randomUUID()}-${safeName(fileName)}`;
  const { data, error } = await createServiceClient().storage.from("materials").createSignedUploadUrl(path);
  if (error) return { error: "Could not start the upload." };
  return { bucket: "materials", path, token: data.token };
}

// Step 2: save the document row, then index it in the background (Uploaded → Processing → Ready/Failed).
export async function finishMaterial(courseId: string, path: string, fileName: string) {
  const me = await getMe();
  if (!path.startsWith(pathPrefix(me.institution.id, courseId)) || path.includes("..")) return { error: "Invalid upload." };

  const { error: missing } = await createServiceClient().storage.from("materials").info(path);
  if (missing) return { error: "Upload not found. Try again." };

  // RLS: insert only allowed for a course this professor teaches.
  const db = await createClient();
  const { data: doc, error } = await db
    .from("documents")
    .insert({ institution_id: me.institution.id, course_id: courseId, uploaded_by: me.id, title: fileName.slice(0, 200), file_path: path })
    .select("id")
    .single();
  if (error) return { error: "Could not save the document." };

  after(() => ingestDocument(doc.id));
  revalidatePath("/courses");
  return {};
}

export async function retryMaterial(documentId: string) {
  await getMe();
  const db = await createClient();
  const { data: doc } = await db.from("documents").select("id, course_id").eq("id", documentId).maybeSingle();
  if (!doc?.course_id || !(await db.rpc("teaches", { course: doc.course_id })).data) return;
  after(() => ingestDocument(doc.id));
  revalidatePath("/courses");
}

export async function retrySummary(documentId: string) {
  await getMe();
  const db = await createClient();
  const { data: doc } = await db.from("documents").select("id, course_id").eq("id", documentId).eq("status", "ready").maybeSingle();
  if (!doc?.course_id || !(await db.rpc("teaches", { course: doc.course_id })).data) return;
  after(() => materialsAgent(doc.id));
  revalidatePath("/courses");
}
