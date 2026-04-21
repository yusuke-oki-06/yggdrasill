import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const extensionCtx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  platform: "node",
  target: "node20",
  outfile: "dist/extension.js",
  external: ["vscode"],
  logLevel: "info",
});

const blueprintCtx = await esbuild.context({
  entryPoints: ["media/blueprint/main.tsx"],
  bundle: true,
  format: "iife",
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  platform: "browser",
  target: "es2022",
  outfile: "dist/blueprint.js",
  loader: { ".tsx": "tsx", ".ts": "ts" },
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": production ? '"production"' : '"development"',
  },
  logLevel: "info",
});

if (watch) {
  await Promise.all([extensionCtx.watch(), blueprintCtx.watch()]);
} else {
  await Promise.all([extensionCtx.rebuild(), blueprintCtx.rebuild()]);
  await Promise.all([extensionCtx.dispose(), blueprintCtx.dispose()]);
}
