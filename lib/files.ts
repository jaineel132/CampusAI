import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { createServiceClient } from "./supabase";

// Text per page from a stored PDF or TXT file.
export async function readPages(bucket: "materials" | "submissions", path: string): Promise<string[]> {
  const { data: file, error } = await createServiceClient().storage.from(bucket).download(path);
  if (error || !file) throw new Error("Could not read the uploaded file.");
  if (path.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    return (await extractText(pdf, { mergePages: false })).text as string[];
  }
  return (await file.text()).split("\f"); // TXT: form feeds mark pages, else one page
}
