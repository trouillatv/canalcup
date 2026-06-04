import sharp from "sharp";
import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const src = join(rootDir, "public", "logo.png");
const outDir = join(rootDir, "public", "icons");

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const icons = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of icons) {
  await sharp(src)
    .resize(size, size, { fit: "contain", background: "#0D0B08" })
    .png()
    .toFile(join(outDir, name));
  console.log(`✓ ${name}`);
}

console.log("Icons generated in public/icons/");
