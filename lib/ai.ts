import "server-only";
import { createGroq } from "@ai-sdk/groq";

// The one provider module: swap the model or provider here.
// ponytail: Groq free tier (~8k tokens/min); if limits bite, switch model id or provider here only.
export const model = createGroq({ apiKey: process.env.GROQ_API_KEY })("openai/gpt-oss-120b");

// gte-small via the Supabase Edge Function `embed` (Groq has no embeddings API).
export async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 16) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ input: texts.slice(i, i + 16) }),
    });
    if (!res.ok) throw new Error(`Embedding failed (${res.status})`);
    out.push(...(await res.json()).embeddings);
  }
  return out;
}
