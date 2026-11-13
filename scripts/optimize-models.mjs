/**
 * Оптимизация GLB: dedup/prune/weld/quantize.
 * Текстуры в ассетах не используются, поэтому атласы не нужны.
 * Запуск: npm run models:optimize (после npm run models)
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, weld } from "@gltf-transform/functions";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const dir = path.resolve(process.cwd(), "public", "models");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const files = (await readdir(dir)).filter((file) => file.endsWith(".glb"));

const manifestFile = path.join(dir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
const byFile = new Map(manifest.models.map((item) => [item.file, item]));

for (const file of files) {
  const full = path.join(dir, file);
  const before = (await readFile(full)).byteLength;
  const document = await io.read(full);
  await document.transform(
    dedup(),
    prune(),
    weld({ tolerance: 0.0001 }),
    quantize({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      quantizeWeight: 12,
      quantizeGeneric: 12,
    }),
  );
  await io.write(full, document);
  const bytes = await readFile(full);
  const entry = byFile.get(file);
  if (entry) {
    entry.bytes = bytes.byteLength;
    entry.sha256 = createHash("sha256").update(bytes).digest("hex");
  }
  console.log(
    `${file.padEnd(20)} ${(before / 1024).toFixed(1)} KB → ${(bytes.byteLength / 1024).toFixed(1)} KB`,
  );
}

manifest.optimizedAt = new Date().toISOString();
manifest.optimization = "dedup + prune + weld + quantize (gltf-transform)";
await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
