import fs from "node:fs";

const csvPath = process.argv[2];
if (!csvPath) throw new Error("Usage: node scripts/import-jumpseller-catalog.mjs <csv>");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

function readEnv(path) {
  const values = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const env = { ...readEnv(".env.local"), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Missing Supabase server credentials");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const request = async (path, options = {}) => {
  const { headers: optionHeaders, ...requestOptions } = options;
  const response = await fetch(`${url}/rest/v1/${path}`, { ...requestOptions, headers: { ...headers, ...optionHeaders } });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const groups = new Map();
for (const row of rows) {
  if (!groups.has(row.Permalink)) groups.set(row.Permalink, []);
  groups.get(row.Permalink).push(row);
}
const existing = await request("products?select=*&limit=1000");
const existingCategories = await request("categories?select=id,name,slug&limit=1000");
const byName = new Map(existing.map((p) => [p.name, p]));
const bySlug = new Map(existing.map((p) => [p.slug, p]));
const categoryBySlug = new Map(existingCategories.map((category) => [category.slug, category]));
const usedSlugs = new Set(existing.map((p) => p.slug));
let inserted = 0, updated = 0;

for (const [permalink, variants] of groups) {
  const base = variants.find((v) => v.Name) || variants[0];
  const sizes = [...new Set(variants.map((v) => v["Variant 1 Option Value"]).filter(Boolean))];
  const prices = variants.map((v) => Number(v.Price)).filter((v) => Number.isFinite(v) && v > 0);
  const categories = base.Categories.split(",").map((v) => v.trim()).filter(Boolean);
  const desiredSlug = slugify(base.Name || permalink);
  const found = byName.get(base.Name) || bySlug.get(desiredSlug);
  let slug = found?.slug || desiredSlug;
  if (!found) { let suffix = 2; const root = slug; while (usedSlugs.has(slug)) slug = `${root}-${suffix++}`; usedSlugs.add(slug); }
  const sourceMatch = permalink.match(/^cutter-([^\-]+)-/i);
  const payload = {
    name: base.Name, slug, sku: found?.sku || `GAL${String(existing.length + inserted + 1).padStart(4, "0")}`,
    source_group: found?.source_group || sourceMatch?.[1] || "csv", source_number: found?.source_number || "",
    description: base.Description || base["Meta Description"] || `Cortador de galleta ${base.Name}`,
    price: Math.round(Math.min(...prices)), stock: 0, size: sizes.join(", "),
    image_url: found?.image_url || "", active: base.Status === "available", featured: base.Featured === "YES",
  };
  let product;
  if (found) {
    product = (await request(`products?id=eq.${found.id}&select=id`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) }))[0];
    updated++;
  } else {
    product = (await request("products?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) }))[0];
    inserted++;
  }
  const indexedProduct = { ...(found || {}), ...payload, id: product.id };
  byName.set(base.Name, indexedProduct);
  bySlug.set(slug, indexedProduct);
  for (const name of categories) {
    const categorySlug = slugify(name);
    let categoryId = categoryBySlug.get(categorySlug)?.id;
    if (!categoryId) {
      const category = (await request("categories?select=id,name,slug", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, slug: categorySlug, active: true }) }))[0];
      categoryId = category.id;
      categoryBySlug.set(categorySlug, category);
    }
    await request("product_categories?on_conflict=product_id,category_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ product_id: product.id, category_id: categoryId }) });
  }
}

console.log(JSON.stringify({ products: groups.size, inserted, updated }, null, 2));
