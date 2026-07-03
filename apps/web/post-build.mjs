import { readFileSync, writeFileSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".open-next");

// 1. Remove symlinked node_modules (not needed at runtime)
for (const dir of ["server-functions/default/node_modules", "server-functions/default/apps/web/node_modules"]) {
  const p = join(outDir, dir);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`  Removed ${dir}`);
  }
}

// 2. Generate wrangler.toml (for Worker deployment with static assets)
const toml = [
  'name = "sagman-frontend"',
  'main = "_worker.js"',
  'compatibility_date = "2024-11-11"',
  'compatibility_flags = ["nodejs_compat"]',
  "",
  '[assets]',
  'directory = "assets"',
  'binding = "ASSETS"',
].join("\n");
writeFileSync(join(outDir, "wrangler.toml"), toml + "\n");

// 3. Patch _worker.js to serve static assets first
const workerPath = join(outDir, "_worker.js");
let code = readFileSync(workerPath, "utf8");
if (!code.includes("env.ASSETS.fetch")) {
  code = code.replace(
    "const url = new URL(request.url);",
    `const url = new URL(request.url);
            if (url.pathname.startsWith("/_next/static/") && env.ASSETS) {
              const asset = await env.ASSETS.fetch(request);
              if (asset.status !== 404) return asset;
            }`
  );
  writeFileSync(workerPath, code);
  console.log("  Patched _worker.js for asset serving");
}

console.log("  Post-build complete");
