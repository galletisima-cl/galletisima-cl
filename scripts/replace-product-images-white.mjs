import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

function readEnv(file) { return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)).filter(Boolean).map((match) => [match[1], match[2].trim().replace(/^['"]|['"]$/g, "")])); }
const env = { ...readEnv(".env.local"), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Missing Supabase server credentials");
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const base = fs.readFileSync("public/catalog-white-base.png");
const exactDirectory = "public/products-ai";

const response = await fetch(`${url}/rest/v1/products?select=id,name,slug,image_url&order=name&limit=1000`, { headers });
if (!response.ok) throw new Error(`Products: ${response.status} ${await response.text()}`);
const products = await response.json();

async function whiteBackground(input) {
  const { data, info } = await sharp(input).resize(800, 800, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) { const r = data[i], g = data[i + 1], b = data[i + 2], spread = Math.max(r, g, b) - Math.min(r, g, b); if (r > 238 && g > 225 && b > 220 && spread < 38) data[i] = data[i + 1] = data[i + 2] = 255; }
  return sharp(data, { raw: info });
}

let completed = 0, exact = 0, catalog = 0;
async function processProduct(product) {
  const exactPath = path.join(exactDirectory, `${product.slug}.webp`);
  let image;
  if (fs.existsSync(exactPath)) { image = await (await whiteBackground(fs.readFileSync(exactPath))).webp({ quality: 84, effort: 5, smartSubsample: true }).toBuffer(); exact++; }
  else { image = await (await whiteBackground(base)).webp({ quality: 82, effort: 5, smartSubsample: true }).toBuffer(); catalog++; }
  const objectPath = `square-v2/${product.slug}.webp`;
  const upload = await fetch(`${url}/storage/v1/object/product-images/${objectPath}`, { method: "POST", headers: { ...headers, "Content-Type": "image/webp", "x-upsert": "true", "Cache-Control": "public, max-age=31536000, immutable" }, body: image });
  if (!upload.ok) throw new Error(`Upload ${product.slug}: ${upload.status} ${await upload.text()}`);
  const imageUrl = `${url}/storage/v1/object/public/product-images/${objectPath}`;
  const update = await fetch(`${url}/rest/v1/products?id=eq.${product.id}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ image_url: imageUrl }) });
  if (!update.ok) throw new Error(`Update ${product.slug}: ${update.status} ${await update.text()}`);
  completed++; console.log(`${completed}/${products.length}\t${product.slug}\t${Math.round(image.length / 1024)} KB`);
}

const queue = [...products];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await processProduct(queue.shift()); }));
console.log(JSON.stringify({ total: completed, exact, standardized: catalog, bucket: "product-images", format: "webp" }));
