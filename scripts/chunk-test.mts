// Run: node scripts/chunk-test.mts
import assert from "node:assert/strict";
import { chunkPages } from "../lib/chunk.ts";

const words = (n: number, p = "w") => Array.from({ length: n }, (_, i) => `${p}${i}`).join(" ");

assert.deepEqual(chunkPages(["", "  "]), [], "blank pages give no chunks");
assert.equal(chunkPages([words(100)]).length, 1, "short page = one chunk");

const long = chunkPages([words(700)]);
assert.equal(long.length, 3, "700 words → chunks at 0, 300, 600");
assert.ok(long[1].content.startsWith("w300"), "second chunk starts after the overlap");
assert.ok(long[0].content.endsWith("w349") && long[1].content.includes("w349"), "chunks overlap by 50 words");
assert.ok(long.at(-1)!.content.endsWith("w699"), "no words dropped at the end");

const multi = chunkPages([words(10, "a"), words(10, "b")]);
assert.deepEqual(multi.map((c) => c.page), [1, 2], "page numbers kept");

console.log("✓ chunk test passed");
