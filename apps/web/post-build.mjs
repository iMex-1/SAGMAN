import { readFileSync, writeFileSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".open-next");

// 1. Remove symlinked node_modules
for (const dir of ["server-functions/default/node_modules", "server-functions/default/apps/web/node_modules"]) {
  const p = join(outDir, dir);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log("  Removed " + dir);
  }
}

// 2. Generate wrangler.toml
const toml = [
  'name = "sagman-frontend"',
  'main = "_worker.js"',
  'compatibility_date = "2024-11-11"',
  'compatibility_flags = ["nodejs_compat"]',
  "",
  "[assets]",
  'directory = "assets"',
  'binding = "ASSETS"',
].join("\n");
writeFileSync(join(outDir, "wrangler.toml"), toml + "\n");

// 3. Patch _worker.js for static assets
const workerPath = join(outDir, "_worker.js");
let code = readFileSync(workerPath, "utf8");
if (!code.includes("env.ASSETS.fetch")) {
  code = code.replace(
    "const url = new URL(request.url);",
    [
      "const url = new URL(request.url);",
      '            if ((url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/")) && env.ASSETS) {',
      "              const asset = await env.ASSETS.fetch(request);",
      '              if (asset.status !== 404) return asset;',
      "            }",
    ].join("\n")
  );
  writeFileSync(workerPath, code);
  console.log("  Patched _worker.js for asset serving");
}

// 4. Patch _worker.js to proxy /api/v1/* to the API Worker
const API_WORKER = "https://sagman-api.moukeddar236med.workers.dev";
const apiProxyLine = 'url.pathname.startsWith("/api/v1/")';
if (!code.includes(apiProxyLine)) {
  const search = 'if ((url.pathname.startsWith("/_next/static/"';
  const replace = [
    'if (url.pathname.startsWith("/api/v1/")) {',
    "              try {",
    '                const textBody = request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined;',
    '                return await fetch("' + API_WORKER + '" + url.pathname + url.search, {',
    "                  method: request.method,",
    "                  headers: request.headers,",
    "                  body: textBody,",
    "                });",
    "              } catch (e) {",
    '                return new Response(JSON.stringify({ error: { code: "PROXY_ERROR", message: "Proxy error: " + e.message, statusCode: 502 } }),',
    '                  { status: 502, headers: { "Content-Type": "application/json" } });',
    "              }",
    "            }",
    '            if ((url.pathname.startsWith("/_next/static/"',
  ].join("\n");
  code = code.replace(search, replace);
  writeFileSync(workerPath, code);
  console.log("  Patched _worker.js for API proxy");
}

console.log("  Post-build complete");
