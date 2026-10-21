// Regenerates lib/database.types.ts from the live schema. Run: npm run db:types
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const out = execFileSync("npx", ["supabase", "gen", "types", "typescript", "--schema", "public", "--db-url", process.env.SUPABASE_DB_URL!], { shell: process.platform === "win32" });
writeFileSync("lib/database.types.ts", out);
console.log("✓ lib/database.types.ts updated");
