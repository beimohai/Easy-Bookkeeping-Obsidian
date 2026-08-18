import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "node:module";
import { readFile } from "node:fs/promises";

const production = process.argv[2] === "production";
const manifest = JSON.parse(await readFile(new URL("./manifest.json", import.meta.url), "utf8"));
const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtinModules],
  format: "cjs",
  target: "es2021",
  loader: { ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  define: { __PLUGIN_VERSION__: JSON.stringify(manifest.version) },
  outfile: "main.js",
  minify: production
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
