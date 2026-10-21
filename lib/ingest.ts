import "server-only";
import { createServiceClient } from "./supabase";
import { embed } from "./ai";
import { chunkPages } from "./chunk";
import { materialsAgent } from "./agents";
import { readPages } from "./files";

// Download → extract text per page → chunk → embed → store → mark ready → Materials agent.
// Any failure is shown as "failed".
export async function ingestDocument(documentId: string) {
  const db = createServiceClient();
  const { data: doc } = await db.from("documents").select("*").eq("id", documentId).single();
  if (!doc) return;
  await db.from("documents").update({ status: "processing", error: null }).eq("id", doc.id);

  try {
    const pages = await readPages("materials", doc.file_path);
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new Error("No text found in this file (scanned PDFs are not supported).");

    const vectors = await embed(chunks.map((c) => c.content));
    await db.from("document_chunks").delete().eq("document_id", doc.id);
    const { error: insertError } = await db.from("document_chunks").insert(
      chunks.map((c, i) => ({
        institution_id: doc.institution_id, document_id: doc.id, course_id: doc.course_id,
        page: c.page, content: c.content, embedding: JSON.stringify(vectors[i]),
      }))
    );
    if (insertError) throw new Error("Could not save the search index.");

    await db.from("documents").update({ status: "ready", page_count: pages.length }).eq("id", doc.id);
  } catch (e) {
    await db.from("documents").update({ status: "failed", error: e instanceof Error ? e.message : "Processing failed." }).eq("id", doc.id);
    return;
  }
  await materialsAgent(doc.id);
}
