// ~350 words ≈ 450 tokens: gte-small reads at most 512 tokens per chunk. Overlap keeps ideas that span a cut.
const CHUNK_WORDS = 350;
const OVERLAP_WORDS = 50;

export function chunkPages(pages: string[]) {
  const chunks: { page: number; content: string }[] = [];
  pages.forEach((text, i) => {
    const words = text.split(/\s+/).filter(Boolean);
    for (let start = 0; start < words.length; start += CHUNK_WORDS - OVERLAP_WORDS) {
      chunks.push({ page: i + 1, content: words.slice(start, start + CHUNK_WORDS).join(" ") });
      if (start + CHUNK_WORDS >= words.length) break;
    }
  });
  return chunks;
}
