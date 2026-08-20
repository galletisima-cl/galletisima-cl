import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const sourceDirectory = "public/products-unique-source";
const outputDirectory = process.env.OUTPUT_DIR || sourceDirectory;
const slugs = process.argv.slice(2);
if (!slugs.length) throw new Error("Pass one or more product slugs");
fs.mkdirSync(outputDirectory, { recursive: true });

function isPink(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return r > 145 && b > 105 && r > g * 1.12 && b > g * 0.88 && b < r * 1.08 && max - min > 22;
}

function recolorLilac(data, pixelIndex) {
  const offset = pixelIndex * 3;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  data[offset] = Math.max(0, Math.min(255, Math.round(luminance + saturation * 0.18)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(luminance - saturation * 0.42)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(luminance + saturation * 0.78)));
}

for (const slug of slugs) {
  const input = path.join(sourceDirectory, `${slug}.png`);
  if (!fs.existsSync(input)) throw new Error(`Missing ${input}`);
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  const mask = new Uint8Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel++) {
    const offset = pixel * 3;
    if (isPink(data[offset], data[offset + 1], data[offset + 2])) mask[pixel] = 1;
  }

  let largest = [];
  const queue = new Int32Array(pixels);
  for (let start = 0; start < pixels; start++) {
    if (mask[start] !== 1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    mask[start] = 2;
    const component = [];
    while (head < tail) {
      const current = queue[head++];
      component.push(current);
      const x = current % info.width;
      const neighbors = [current - info.width, current + info.width];
      if (x > 0) neighbors.push(current - 1);
      if (x + 1 < info.width) neighbors.push(current + 1);
      for (const next of neighbors) {
        if (next >= 0 && next < pixels && mask[next] === 1) {
          mask[next] = 2;
          queue[tail++] = next;
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }

  if (largest.length < pixels * 0.002) throw new Error(`${slug}: no substantial pink mold region found`);
  for (const pixel of largest) recolorLilac(data, pixel);
  const output = path.join(outputDirectory, `${slug}.png`);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toFile(output);
  console.log(`${slug}\t${largest.length} pixels\t${output}`);
}
