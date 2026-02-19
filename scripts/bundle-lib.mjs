import * as esbuild from "esbuild";
import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const libRoot = join(__dirname, "..", "lib");

// Discover all .js source modules (skip tests, dist, etc.)
const entries = readdirSync(libRoot)
  .filter(
    (f) => f.endsWith(".js") && !f.includes(".test.") && !f.includes(".spec.")
  )
  .map((f) => join(libRoot, f));

console.log("Bundling lib modules:", entries.map((e) => e.split(/[\\/]/).pop()));

// Bundle each lib module into lib/dist/ as a self-contained CJS file.
// All pure-JS dependencies (extract-zip, archiver, fs-extra, mustache, uuid …)
// are inlined so the packaged Electron app doesn't need node_modules for them.
await esbuild.build({
  entryPoints: entries,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outdir: join(libRoot, "dist"),
  logLevel: "warning",
  // Node builtins are kept external — they're always available in Electron
  external: ["electron"],
});

console.log(`Bundled ${entries.length} lib modules → lib/dist/`);
