import fs from "node:fs";
import path from "node:path";

function readEnv(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = { ...readEnv(".env.local"), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const directory = process.argv[2] || "public/products-ai";
if (!url || !key) throw new Error("Missing Supabase server credentials");

const files = fs.readdirSync(directory).filter((name) => name.endsWith(".webp"));
for (const filename of files) {
  const slug = path.basename(filename, ".webp");
  const bytes = fs.readFileSync(path.join(directory, filename));
  const objectPath = `ai/${filename}`;
  const upload = await fetch(`${url}/storage/v1/object/product-images/${objectPath}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "image/webp", "x-upsert": "true" },
    body: bytes,
  });
  if (!upload.ok) throw new Error(`Upload ${filename}: ${upload.status} ${await upload.text()}`);
  const publicUrl = `${url}/storage/v1/object/public/product-images/${objectPath}`;
  const update = await fetch(`${url}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ image_url: publicUrl }),
  });
  if (!update.ok) throw new Error(`Update ${slug}: ${update.status} ${await update.text()}`);
  const rows = await update.json();
  if (rows.length !== 1) throw new Error(`Expected one product for ${slug}, got ${rows.length}`);
  console.log(`${slug}\t${bytes.length}\t${publicUrl}`);
}
