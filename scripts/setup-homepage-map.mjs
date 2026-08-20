import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const sourceDir = "C:/Users/jorge/.codex/generated_images/019ffad0-2b54-7cd2-9c48-44a050fd1b43";
const assets = {
  "Fiestas Patrias": "exec-03ff871a-dfe5-4951-9a93-5f1a3e1c686e.png",
  Halloween: "exec-24483406-45df-4699-b99f-80f66c9cb7c7.png",
  ToyStory: "exec-69b9796e-98ca-443f-98be-cb8f68864049.png",
  Snoopy: "exec-3896f5f1-8ed3-48bb-8552-b0a6aa0e8731.png",
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: categories, error: categoryError } = await supabase.from("categories").select("id,name");
if (categoryError) throw categoryError;
const findCategory = (needle) => categories.find((category) => category.name.replace(/^Todo\s+/i, "").toLowerCase() === needle.toLowerCase());
const uploaded = {};

for (const [categoryName, filename] of Object.entries(assets)) {
  const category = findCategory(categoryName);
  if (!category) throw new Error(`No existe la categoría ${categoryName}`);
  const input = await fs.readFile(path.join(sourceDir, filename));
  const desktop = await sharp(input).resize(1920, 840, { fit: "cover", position: "center" }).webp({ quality: 82, effort: 5 }).toBuffer();
  const mobile = await sharp(input).resize(900, 1125, { fit: "cover", position: "attention" }).webp({ quality: 80, effort: 5 }).toBuffer();
  uploaded[categoryName] = { categoryId: category.id };
  for (const [device, buffer] of [["desktop", desktop], ["mobile", mobile]]) {
    const objectPath = `banners/generated/${category.id}/${device}.webp`;
    const { error } = await supabase.storage.from("product-images").upload(objectPath, buffer, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
    if (error) throw error;
    uploaded[categoryName][device] = supabase.storage.from("product-images").getPublicUrl(objectPath).data.publicUrl;
  }
}

const { data: currentSettings } = await supabase.from("site_settings").select("key,value").in("key", ["category_banner_urls", "category_mobile_banner_urls"]);
const settings = Object.fromEntries((currentSettings || []).map((entry) => [entry.key, entry.value]));
const desktopMap = settings.category_banner_urls ? JSON.parse(settings.category_banner_urls) : {};
const mobileMap = settings.category_mobile_banner_urls ? JSON.parse(settings.category_mobile_banner_urls) : {};
for (const item of Object.values(uploaded)) { desktopMap[item.categoryId] = item.desktop; mobileMap[item.categoryId] = item.mobile; }
const features = ["Halloween", "ToyStory", "Snoopy"].map((name) => ({ categoryId: uploaded[name].categoryId, imageUrl: uploaded[name].desktop, mobileImageUrl: uploaded[name].mobile }));
const now = new Date().toISOString();
const { error: settingsError } = await supabase.from("site_settings").upsert([
  { key: "seasonal_category_id", value: uploaded["Fiestas Patrias"].categoryId, updated_at: now },
  { key: "instagram_url", value: "https://www.instagram.com/galletisimacl", updated_at: now },
  { key: "category_feature_banners", value: JSON.stringify(features), updated_at: now },
  { key: "category_banner_urls", value: JSON.stringify(desktopMap), updated_at: now },
  { key: "category_mobile_banner_urls", value: JSON.stringify(mobileMap), updated_at: now },
]);
if (settingsError) throw settingsError;
console.log(JSON.stringify({ uploaded, desktopBytes: Object.keys(uploaded).length, configured: true }, null, 2));
