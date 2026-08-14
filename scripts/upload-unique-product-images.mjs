import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

function readEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)).filter(Boolean).map((match) => [match[1], match[2].trim().replace(/^['"]|['"]$/g, "")]))
}

const env = { ...readEnv(".env.local"), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Missing Supabase server credentials");

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const sourceDirectory = "public/products-unique-source";
const requestedSlugs = new Set(process.argv.slice(2));
const files = fs.readdirSync(sourceDirectory).filter((file) => {
  if (!/\.(png|jpe?g|webp)$/i.test(file)) return false;
  return requestedSlugs.size === 0 || requestedSlugs.has(path.parse(file).name);
});
if (requestedSlugs.size > 0 && files.length !== requestedSlugs.size) {
  const found = new Set(files.map((file) => path.parse(file).name));
  throw new Error(`Missing source images: ${[...requestedSlugs].filter((slug) => !found.has(slug)).join(", ")}`);
}

for (const file of files) {
  const slug = path.parse(file).name;
  const productResponse = await fetch(`${url}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&select=id,slug&limit=1`, { headers });
  if (!productResponse.ok) throw new Error(`Product ${slug}: ${productResponse.status} ${await productResponse.text()}`);
  const [product] = await productResponse.json();
  if (!product) throw new Error(`Unknown product slug: ${slug}`);

  const image = await sharp(path.join(sourceDirectory, file))
    .resize(1000, 1000, { fit: "cover" })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 88, effort: 6, smartSubsample: true })
    .toBuffer();
  const objectPath = `unique-v3/${slug}.webp`;
  const upload = await fetch(`${url}/storage/v1/object/product-images/${objectPath}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "image/webp", "x-upsert": "true", "Cache-Control": "public, max-age=31536000, immutable" },
    body: image,
  });
  if (!upload.ok) throw new Error(`Upload ${slug}: ${upload.status} ${await upload.text()}`);

  const imageUrl = `${url}/storage/v1/object/public/product-images/${objectPath}`;
  const update = await fetch(`${url}/rest/v1/products?id=eq.${product.id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl }),
  });
  if (!update.ok) throw new Error(`Update ${slug}: ${update.status} ${await update.text()}`);
  console.log(`${slug}\t${Math.round(image.length / 1024)} KB\t${imageUrl}`);
}

console.log(JSON.stringify({ uploaded: files.length, format: "webp", size: "1000x1000", path: "unique-v3" }));
