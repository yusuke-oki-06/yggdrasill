// Render media/yggdrasil-icon.svg to a 128x128 PNG. Marketplace requires PNG.
// Run with `node scripts/build-icon.mjs`.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const inputPath = path.join(root, "media", "yggdrasil-icon.svg");
const outputPath = path.join(root, "media", "yggdrasil-icon.png");

const raw = await fs.readFile(inputPath, "utf8");

// The source SVG uses currentColor + a viewBox of 0 0 24. Wrap it on a solid
// dark backdrop so the line art is visible against the Marketplace card.
const wrapped = raw
  .replace(
    /<svg([^>]*)>/,
    `<svg$1 style="background:#0f172a;color:#a78bfa">`,
  )
  .replace('stroke-width="1.5"', 'stroke-width="1.2"');

const resvg = new Resvg(wrapped, {
  fitTo: { mode: "width", value: 128 },
  background: "#0f172a",
});
const pngData = resvg.render();
await fs.writeFile(outputPath, pngData.asPng());

console.log(`wrote ${outputPath} (${pngData.asPng().length} bytes)`);
