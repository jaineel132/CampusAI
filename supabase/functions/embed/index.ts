// Embeds text with Supabase's built-in gte-small model (384 dims). No external API key needed.
// Deploy: npx supabase functions deploy embed --project-ref <ref>
const session = new (globalThis as any).Supabase.ai.Session("gte-small");

Deno.serve(async (req) => {
  const { input } = await req.json();
  if (!Array.isArray(input) || input.length === 0 || input.length > 16) {
    return Response.json({ error: "input must be an array of 1-16 strings" }, { status: 400 });
  }
  const embeddings = [];
  for (const text of input) embeddings.push(await session.run(String(text), { mean_pool: true, normalize: true }));
  return Response.json({ embeddings });
});
