import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public", "icons", "icon.svg");
const outDir = path.join(root, "public", "icons");

async function png(size: number, file: string) {
  const svg = await readFile(source);
  const buffer = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(outDir, file), buffer);
  console.log(`icons: ${file} (${size}×${size}, ${(buffer.length / 1024).toFixed(1)} KB)`);
}

function icoFromPng(pngBuffer: Buffer): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(64, 0);
  entry.writeUInt8(64, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await png(192, "icon-192.png");
  await png(512, "icon-512.png");
  await png(180, "apple-touch-icon.png");
  await png(512, "maskable-512.png");

  const svg = await readFile(source);
  const faviconPng = await sharp(svg, { density: 384 })
    .resize(64, 64, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(root, "public", "favicon.ico"), icoFromPng(faviconPng));
  console.log("icons: favicon.ico (64×64 PNG payload)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
