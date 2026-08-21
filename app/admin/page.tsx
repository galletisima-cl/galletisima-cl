"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminProductCsvImporter from "../../components/AdminProductCsvImporter";
import { createClient } from "../../lib/supabase/client";
import { DEFAULT_HERO_CONTENT, HERO_SETTING_KEYS, type HeroContent } from "../../lib/hero-content";
import type { CsvImportProduct } from "../../lib/product-csv-import";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
};
type Product = {
  id: string;
  category_ids: string[];
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: number;
  stock: number;
  size: string;
  size_prices: string;
  image_url: string;
  image_urls: string[];
  active: boolean;
  featured: boolean;
};
type ExistingImportProduct = { id: string; sku: string; slug: string; description: string };
type CategoryFeatureBanner = { categoryId: string; imageUrl: string; mobileImageUrl?: string };
type NavigationLink = { id: string; label: string; href: string };
type NavigationConfig = { menus: { id: string; label: string }[]; links: NavigationLink[]; itemOrder: string[]; categoryMenu: Record<string, string>; categoryOrder: string[] };
const defaultNavigationLinks: NavigationLink[] = [
  { id: "home", label: "Inicio", href: "/" },
  { id: "altars", label: "Altares", href: "/?buscar=altares#catalogo" },
  { id: "tools", label: "Herramientas", href: "/?buscar=herramientas#catalogo" },
  { id: "all", label: "Ver todo", href: "/?ver=todos#catalogo" },
  { id: "more", label: "Más", href: "/contacto" },
];
const defaultNavigation: NavigationConfig = { menus: [{ id: "celebrations", label: "Celebraciones" }, { id: "characters", label: "Personajes" }, { id: "themes", label: "Temáticas" }], links: defaultNavigationLinks, itemOrder: ["link:home", "menu:celebrations", "menu:characters", "menu:themes", "link:altars", "link:tools", "link:all", "link:more"], categoryMenu: {}, categoryOrder: [] };
const celebrationCategoryTerms = ["navidad", "baby-shower", "halloween", "ninos", "papa", "mama", "celebracion", "fiestas-patrias", "bebes"];
const characterCategoryTerms = ["toy", "snoopy", "stitch", "pokemon", "bluey", "gabby", "marvel", "pooh", "disney", "bob-esponja", "pawpatrol", "spiderman", "lilo", "netflix"];

function normalizeNavigation(config: NavigationConfig, categories: Category[]): NavigationConfig {
  const menus = config.menus.length ? config.menus : defaultNavigation.menus;
  const configuredLinks = Array.isArray(config.links) ? config.links : [];
  const links = defaultNavigationLinks.map((fallback) => configuredLinks.find((item) => item.id === fallback.id) || fallback);
  const menuIds = new Set(menus.map((menu) => menu.id));
  const categoryMenu: Record<string, string> = {};
  categories.forEach((category) => {
    if (Object.prototype.hasOwnProperty.call(config.categoryMenu, category.id)) {
      categoryMenu[category.id] = config.categoryMenu[category.id];
      return;
    }
    const fallback = celebrationCategoryTerms.some((term) => category.slug.includes(term)) ? "celebrations" : characterCategoryTerms.some((term) => category.slug.includes(term)) ? "characters" : "themes";
    categoryMenu[category.id] = menuIds.has(fallback) ? fallback : menus.at(-1)?.id || "";
  });
  const categoryIds = new Set(categories.map((category) => category.id));
  const categoryOrder = [...config.categoryOrder.filter((id) => categoryIds.has(id)), ...categories.map((category) => category.id).filter((id) => !config.categoryOrder.includes(id))];
  const validItems = [...links.map((link) => `link:${link.id}`), ...menus.map((menu) => `menu:${menu.id}`)];
  const configuredOrder = Array.isArray(config.itemOrder) ? config.itemOrder : defaultNavigation.itemOrder;
  const itemOrder = [...configuredOrder.filter((id) => validItems.includes(id)), ...validItems.filter((id) => !configuredOrder.includes(id))];
  return { menus, links, itemOrder, categoryMenu, categoryOrder };
}
const emptyProduct = {
  id: "",
  category_ids: [] as string[],
  name: "",
  sku: "",
  description: "",
  price: 0,
  stock: 0,
  size: "",
  size_prices: "",
  image_url: "",
  image_urls: [] as string[],
  active: true,
  featured: false,
};
const nav = [
  "Resumen",
  "Pedidos",
  "Productos",
  "Categorías",
  "Banners",
  "Clientes",
  "Configuración",
].map((label) => [<AdminNavIcon key={label} name={label} />, label] as const);
function AdminNavIcon({ name }: { name: string }) {
  const p = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "Resumen")
    return (
      <svg viewBox="0 0 24 24" {...p}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  if (name === "Pedidos")
    return (
      <svg viewBox="0 0 24 24" {...p}>
        <path d="M6 7h12l-1 14H7L6 7Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </svg>
    );
  if (name === "Productos")
    return (
      <svg viewBox="0 0 24 24" {...p}>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" />
      </svg>
    );
  if (name === "Categorías")
    return (
      <svg viewBox="0 0 24 24" {...p}>
        <path d="M4 5.5h3M4 12h3M4 18.5h3M10 5.5h10M10 12h10M10 18.5h10" />
      </svg>
    );
  if (name === "Banners")
    return (
      <svg viewBox="0 0 24 24" {...p}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8" cy="10" r="1.5" />
        <path d="m4.5 17 5-5 3.5 3 2.5-2 4 4" />
      </svg>
    );
  if (name === "Clientes")
    return (
      <svg viewBox="0 0 24 24" {...p}>
        <circle cx="9" cy="7" r="4" />
        <path d="M2.5 21v-2a6.5 6.5 0 0 1 13 0v2M16 4.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 3.5 5.5V21" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4l-.4 3.1a8 8 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 3.1h4l.4-3.1a8 8 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" />
    </svg>
  );
}

export default function AdminPage() {
  const [ready, setReady] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [loading, setLoading] = useState(false);
  const [view, setView] = useState("Resumen"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [categories, setCategories] = useState<Category[]>([]),
    [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<typeof emptyProduct | null>(null),
    [selectedImages, setSelectedImages] = useState<File[]>([]),
    [categoryName, setCategoryName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("56975265959");
  const [heroBannerUrl, setHeroBannerUrl] = useState("");
  const [heroMobileBannerUrl, setHeroMobileBannerUrl] = useState("");
  const [heroContent, setHeroContent] = useState<HeroContent>(DEFAULT_HERO_CONTENT);
  const [selectedBanner, setSelectedBanner] = useState<File | null>(null);
  const [selectedMobileBanner, setSelectedMobileBanner] = useState<File | null>(null);
  const [categoryBannerUrls, setCategoryBannerUrls] = useState<Record<string, string>>({});
  const [categoryMobileBannerUrls, setCategoryMobileBannerUrls] = useState<Record<string, string>>({});
  const [categoryFeatureBanners, setCategoryFeatureBanners] = useState<CategoryFeatureBanner[]>([]);
  const [seasonalCategoryId, setSeasonalCategoryId] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [navigationConfig, setNavigationConfig] = useState<NavigationConfig>(defaultNavigation);
  const [productSizePrices, setProductSizePrices] = useState<Record<string, Record<string, number>>>({});
  const [facebookUrl, setFacebookUrl] = useState(
    "https://www.facebook.com/share/1Emwhrwy9q/?mibextid=wwXIfr",
  );
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setReady(true);
      if (data.user) loadCatalog();
    });
  }, []);
  async function loadCatalog() {
    const [categoryResult, productResult, settingsResult] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase
          .from("products")
          .select("*, product_categories(category_id), product_images(image_url,sort_order)")
          .order("name"),
        supabase
          .from("site_settings")
          .select("key,value")
          .in("key", ["whatsapp_number", "facebook_url", "hero_banner_url", "hero_mobile_banner_url", ...Object.values(HERO_SETTING_KEYS), "category_banner_urls", "category_mobile_banner_urls", "category_feature_banners", "category_navigation", "product_size_prices", "seasonal_category_id", "instagram_url"]),
      ]);
    const { data: c, error: ce } = categoryResult;
    let { data: p, error: pe } = productResult;
    if (pe) {
      const fallback = await supabase.from("products").select("*, product_categories(category_id)").order("name");
      p = fallback.data as typeof p;
      pe = fallback.error;
    }
    const { data: settings } = settingsResult;
    if (ce || pe) setError(ce?.message || pe?.message || "");
    else {
      setCategories(c || []);
      setProducts(
        (p || []).map((row: any) => ({
          ...row,
          size_prices: "",
          category_ids: (row.product_categories || []).map(
            (link: any) => link.category_id,
          ),
          image_urls: (row.product_images || []).length
            ? row.product_images.sort((a: any, b: any) => a.sort_order - b.sort_order).map((image: any) => image.image_url)
            : row.image_url ? [row.image_url] : [],
        })),
      );
      const values = Object.fromEntries(
        (settings || []).map((setting) => [setting.key, setting.value]),
      );
      if (values.whatsapp_number) setWhatsappNumber(values.whatsapp_number);
      if (values.facebook_url) setFacebookUrl(values.facebook_url);
      if (values.hero_banner_url) setHeroBannerUrl(values.hero_banner_url);
      if (values.hero_mobile_banner_url) setHeroMobileBannerUrl(values.hero_mobile_banner_url);
      setHeroContent({
        eyebrow: values[HERO_SETTING_KEYS.eyebrow] || DEFAULT_HERO_CONTENT.eyebrow,
        title: values[HERO_SETTING_KEYS.title] || DEFAULT_HERO_CONTENT.title,
        subtitle: values[HERO_SETTING_KEYS.subtitle] || DEFAULT_HERO_CONTENT.subtitle,
        primaryButton: values[HERO_SETTING_KEYS.primaryButton] || DEFAULT_HERO_CONTENT.primaryButton,
        secondaryButton: values[HERO_SETTING_KEYS.secondaryButton] || DEFAULT_HERO_CONTENT.secondaryButton,
      });
      if (values.seasonal_category_id) setSeasonalCategoryId(values.seasonal_category_id);
      if (values.instagram_url) setInstagramUrl(values.instagram_url);
      if (values.category_banner_urls) {
        try {
          setCategoryBannerUrls(JSON.parse(values.category_banner_urls));
        } catch {
          setCategoryBannerUrls({});
        }
      }
      if (values.category_mobile_banner_urls) {
        try { setCategoryMobileBannerUrls(JSON.parse(values.category_mobile_banner_urls)); } catch { setCategoryMobileBannerUrls({}); }
      }
      if (values.category_feature_banners) {
        try {
          setCategoryFeatureBanners(JSON.parse(values.category_feature_banners));
        } catch {
          setCategoryFeatureBanners([]);
        }
      }
      if (values.category_navigation) {
        try { setNavigationConfig(normalizeNavigation(JSON.parse(values.category_navigation), c || [])); } catch { setNavigationConfig(normalizeNavigation(defaultNavigation, c || [])); }
      }
      if (values.product_size_prices) {
        try {
          const parsed = JSON.parse(values.product_size_prices);
          setProductSizePrices(parsed);
          setProducts((current) => current.map((product) => ({ ...product, size_prices: formatSizePrices(parsed[product.id] || {}) })));
        } catch { setProductSizePrices({}); }
      }
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setLoading(false);
    if (error) return setError("Correo o contraseña incorrectos");
    if (data.user?.app_metadata.role !== "admin") {
      await supabase.auth.signOut();
      return setError("Esta cuenta no tiene permisos de administración");
    }
    setSignedIn(true);
    loadCatalog();
  }
  async function logout() {
    await supabase.auth.signOut();
    setSignedIn(false);
  }
  async function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const sku = cleanSku(editing.sku);
    if (!sku)
      return setError(
        "El SKU debe contener solamente letras mayúsculas y números",
      );
    if (!editing.category_ids.length)
      return setError("Selecciona al menos una categoría para el producto");
    setLoading(true);
    setError("");
    try {
      const existingUrls = editing.image_urls.length
        ? editing.image_urls
        : editing.image_url ? [editing.image_url] : [];
      if (existingUrls.length + selectedImages.length > 8)
        throw new Error("Cada producto puede tener un máximo de 8 fotos");
      const uploadedUrls: string[] = [];
      for (const file of selectedImages) {
        const compressed = await compressProductImage(file);
        const path = `${sku}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(path, compressed, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
        if (uploadError) throw uploadError;
        uploadedUrls.push(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
      }
      const imageUrls = [...existingUrls, ...uploadedUrls];
      const imageUrl = imageUrls[0] || "";
      const payload: Record<string, string | number | boolean> = {
        name: editing.name.trim(),
        slug: slugify(editing.name),
        sku,
        description: editing.description,
        price: Number(editing.price),
        stock: Number(editing.stock),
        size: normalizeSizes(editing.size),
        image_url: imageUrl,
        active: editing.active,
        featured: editing.featured,
      };
      const { error: categoryColumnError } = await supabase.from("products").select("category_id").limit(1);
      if (!categoryColumnError) payload.category_id = editing.category_ids[0];
      const query = editing.id
        ? supabase.from("products").update(payload).eq("id", editing.id)
        : supabase.from("products").insert(payload);
      const { data, error } = await query.select("id").single();
      if (error) throw error;
      const savedProductId = data.id;
      const { error: galleryTableError } = await supabase.from("product_images").select("id").limit(1);
      if (galleryTableError) throw new Error(`No fue posible guardar la galería: ${galleryTableError.message}`);
      const { error: clearImagesError } = await supabase.from("product_images").delete().eq("product_id", savedProductId);
      if (clearImagesError) throw clearImagesError;
      if (imageUrls.length) {
        const { error: galleryError } = await supabase.from("product_images").insert(imageUrls.map((image_url, sort_order) => ({ product_id: savedProductId, image_url, sort_order })));
        if (galleryError) throw galleryError;
      }
      const nextSizePrices = { ...productSizePrices, [savedProductId]: parseSizePrices(editing.size_prices) };
      const { error: priceError } = await supabase.from("site_settings").upsert({ key: "product_size_prices", value: JSON.stringify(nextSizePrices), updated_at: new Date().toISOString() });
      if (priceError) throw priceError;
      setProductSizePrices(nextSizePrices);
      const productId = data.id;
      const { error: unlinkError } = await supabase
        .from("product_categories")
        .delete()
        .eq("product_id", productId);
      if (unlinkError) throw unlinkError;
      if (editing.category_ids.length) {
        const { error: linkError } = await supabase
          .from("product_categories")
          .insert(
            editing.category_ids.map((category_id) => ({
              product_id: productId,
              category_id,
            })),
          );
        if (linkError) throw linkError;
      }
      setEditing(null);
      setSelectedImages([]);
      setNotice("Producto guardado correctamente");
      await loadCatalog();
    } catch (error: any) {
      setError(
        error?.code === "23505"
          ? "Ese SKU ya está siendo utilizado"
          : error?.message || "No fue posible guardar el producto",
      );
    } finally {
      setLoading(false);
    }
  }
  async function deleteProduct(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) setError(error.message);
    else {
      setNotice("Producto eliminado");
      loadCatalog();
    }
  }
  async function importCsvProducts(importedProducts: CsvImportProduct[]) {
    setLoading(true);
    setError("");
    setNotice("");
    let completed = 0;
    try {
      const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
      const requestedCategoryNames = [...new Set(importedProducts.flatMap((product) => product.categories))];
      for (const name of requestedCategoryNames) {
        const slug = slugify(name);
        if (categoryBySlug.has(slug)) continue;
        const { data, error } = await supabase.from("categories").insert({ name, slug, description: "", active: true }).select("id,name,slug,description,active").single();
        if (error?.code === "23505") {
          const existing = await supabase.from("categories").select("id,name,slug,description,active").eq("slug", slug).single();
          if (existing.error) throw existing.error;
          categoryBySlug.set(slug, existing.data as Category);
        } else {
          if (error) throw error;
          categoryBySlug.set(slug, data as Category);
        }
      }
      const { data: existingRows, error: existingError } = await supabase.from("products").select("id,name,slug,sku,description,price,stock,size,image_url,active,featured");
      if (existingError) throw existingError;
      const existingCatalog = (existingRows || []) as ExistingImportProduct[];
      const existingBySku = new Map(existingCatalog.map((product) => [product.sku, product]));
      const existingBySlug = new Map(existingCatalog.map((product) => [product.slug, product]));
      const nextSizePrices = { ...productSizePrices };
      for (const product of importedProducts) {
        const slug = slugify(product.name);
        const existing = existingBySku.get(product.sku) || existingBySlug.get(slug);
        const categoryIds = product.categories.map((name) => categoryBySlug.get(slugify(name))?.id).filter((id): id is string => Boolean(id));
        if (!categoryIds.length) throw new Error(`${product.name}: no fue posible asociar sus categorías`);
        const payload: Record<string, string | number | boolean> = {
          name: product.name.trim(), slug, sku: product.sku,
          description: product.description || existing?.description || "",
          price: product.price, stock: product.stock,
          size: product.sizes.join(", "), active: product.active,
          featured: product.featured, category_id: categoryIds[0],
        };
        if (product.images.length) payload.image_url = product.images[0];
        const query = existing
          ? supabase.from("products").update(payload).eq("id", existing.id)
          : supabase.from("products").insert(payload);
        const { data: saved, error: productError } = await query.select("id").single();
        if (productError) throw new Error(`${product.name}: ${productError.message}`);
        const productId = saved.id;
        const { error: unlinkError } = await supabase.from("product_categories").delete().eq("product_id", productId);
        if (unlinkError) throw new Error(`${product.name}: ${unlinkError.message}`);
        const { error: linkError } = await supabase.from("product_categories").insert(categoryIds.map((category_id) => ({ product_id: productId, category_id })));
        if (linkError) throw new Error(`${product.name}: ${linkError.message}`);
        if (product.images.length) {
          const { error: clearImagesError } = await supabase.from("product_images").delete().eq("product_id", productId);
          if (clearImagesError) throw new Error(`${product.name}: ${clearImagesError.message}`);
          const { error: imageError } = await supabase.from("product_images").insert(product.images.slice(0, 8).map((image_url, sort_order) => ({ product_id: productId, image_url, sort_order })));
          if (imageError) throw new Error(`${product.name}: ${imageError.message}`);
        }
        if (Object.keys(product.sizePrices).length) nextSizePrices[productId] = product.sizePrices;
        const savedIndex = { id: productId, sku: product.sku, slug, description: String(payload.description) };
        existingBySku.set(product.sku, savedIndex);
        existingBySlug.set(slug, savedIndex);
        completed += 1;
      }
      const { error: priceError } = await supabase.from("site_settings").upsert({ key: "product_size_prices", value: JSON.stringify(nextSizePrices), updated_at: new Date().toISOString() });
      if (priceError) throw priceError;
      setProductSizePrices(nextSizePrices);
      await loadCatalog();
      setNotice(`${completed} productos importados correctamente`);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "No fue posible importar el CSV";
      setError(`${completed ? `${completed} productos alcanzaron a importarse. ` : ""}${message}`);
      await loadCatalog();
    } finally {
      setLoading(false);
    }
  }
  async function addCategory(e: FormEvent) {
    e.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    const { error } = await supabase
      .from("categories")
      .insert({ name, slug: slugify(name), active: true });
    if (error) setError(error.message);
    else {
      setCategoryName("");
      setNotice("Categoría creada");
      loadCatalog();
    }
  }
  async function deleteCategory(id: string) {
    if (products.some((p) => p.category_ids.includes(id)))
      return setError(
        "Mueve o elimina sus productos antes de borrar la categoría",
      );
    if (!confirm("¿Eliminar esta categoría?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) setError(error.message);
    else loadCatalog();
  }
  async function saveNavigation(next: NavigationConfig) {
    setLoading(true); setError("");
    const completeNavigation = normalizeNavigation(next, categories);
    const { error } = await supabase.from("site_settings").upsert({ key: "category_navigation", value: JSON.stringify(completeNavigation), updated_at: new Date().toISOString() });
    setLoading(false);
    if (error) setError(error.message); else { setNavigationConfig(completeNavigation); setNotice("Menús y orden actualizados"); }
  }
  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    const number = whatsappNumber.replace(/\D/g, "");
    if (!/^569\d{8}$/.test(number))
      return setError("Ingresa el número chileno con formato 569XXXXXXXX");
    let validFacebookUrl: URL;
    try {
      validFacebookUrl = new URL(facebookUrl.trim());
    } catch {
      return setError("Ingresa una URL válida de Facebook");
    }
    if (!/(^|\.)facebook\.com$/i.test(validFacebookUrl.hostname))
      return setError("La URL debe pertenecer a facebook.com");
    setLoading(true);
    setError("");
    const { error } = await supabase
      .from("site_settings")
      .upsert([
        { key: "whatsapp_number", value: number, updated_at: new Date().toISOString() },
        { key: "facebook_url", value: validFacebookUrl.toString(), updated_at: new Date().toISOString() },
      ]);
    setLoading(false);
    if (error) setError(error.message);
    else {
      setWhatsappNumber(number);
      setFacebookUrl(validFacebookUrl.toString());
      setNotice("Configuración de contacto actualizada");
    }
  }

  async function saveHeroBanner(e: FormEvent, device: "desktop" | "mobile" = "desktop") {
    e.preventDefault();
    const selectedFile = device === "mobile" ? selectedMobileBanner : selectedBanner;
    if (!selectedFile) return setError("Selecciona una imagen para el banner");
    setLoading(true);
    setError("");
    try {
      const compressed = device === "mobile" ? await compressCategoryMobileImage(selectedFile) : await compressBannerImage(selectedFile);
      const path = `banners/hero/${device}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, compressed, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const publicUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      const { error: settingError } = await supabase.from("site_settings").upsert({
        key: device === "mobile" ? "hero_mobile_banner_url" : "hero_banner_url",
        value: publicUrl,
        updated_at: new Date().toISOString(),
      });
      if (settingError) throw settingError;
      if (device === "mobile") { setHeroMobileBannerUrl(publicUrl); setSelectedMobileBanner(null); }
      else { setHeroBannerUrl(publicUrl); setSelectedBanner(null); }
      setNotice(`Portada para ${device === "mobile" ? "móvil" : "escritorio"} actualizada`);
    } catch (bannerError) {
      setError(bannerError instanceof Error ? bannerError.message : "No fue posible guardar el banner");
    } finally {
      setLoading(false);
    }
  }

  async function saveHeroContent(e: FormEvent) {
    e.preventDefault();
    const normalized = Object.fromEntries(
      Object.entries(heroContent).map(([key, value]) => [key, value.trim()]),
    ) as HeroContent;
    if (Object.values(normalized).some((value) => !value))
      return setError("Completa todos los textos del banner");
    setLoading(true);
    setError("");
    const updatedAt = new Date().toISOString();
    const { error: contentError } = await supabase.from("site_settings").upsert([
      { key: HERO_SETTING_KEYS.eyebrow, value: normalized.eyebrow, updated_at: updatedAt },
      { key: HERO_SETTING_KEYS.title, value: normalized.title, updated_at: updatedAt },
      { key: HERO_SETTING_KEYS.subtitle, value: normalized.subtitle, updated_at: updatedAt },
      { key: HERO_SETTING_KEYS.primaryButton, value: normalized.primaryButton, updated_at: updatedAt },
      { key: HERO_SETTING_KEYS.secondaryButton, value: normalized.secondaryButton, updated_at: updatedAt },
    ]);
    setLoading(false);
    if (contentError) setError(contentError.message);
    else {
      setHeroContent(normalized);
      setNotice("Textos de la portada actualizados");
    }
  }

  async function saveCategoryResponsiveImage(categoryId: string, device: "desktop" | "mobile", file: File) {
    setLoading(true); setError("");
    try {
      const compressed = device === "mobile" ? await compressCategoryMobileImage(file) : await compressCategoryImage(file);
      const path = `banners/categories/${categoryId}/${device}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(path, compressed, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      const publicUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      const current = device === "mobile" ? categoryMobileBannerUrls : categoryBannerUrls;
      const next = { ...current, [categoryId]: publicUrl };
      const key = device === "mobile" ? "category_mobile_banner_urls" : "category_banner_urls";
      const { error: settingError } = await supabase.from("site_settings").upsert({ key, value: JSON.stringify(next), updated_at: new Date().toISOString() });
      if (settingError) throw settingError;
      if (device === "mobile") setCategoryMobileBannerUrls(next); else setCategoryBannerUrls(next);
      setNotice(`Imagen para ${device === "mobile" ? "celular" : "escritorio"} actualizada`);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "No fue posible guardar la imagen"); }
    finally { setLoading(false); }
  }

  async function saveCategoryFeatureBanner(slot: number, categoryId: string, device: "desktop" | "mobile", file: File) {
    setLoading(true);
    setError("");
    try {
      const compressed = device === "mobile" ? await compressCategoryMobileImage(file) : await compressFeatureBannerImage(file);
      const path = `banners/category-features/${slot + 1}/${device}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(path, compressed, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const publicUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      const next = Array.from({ length: 3 }, (_, index) => categoryFeatureBanners[index] || { categoryId: "", imageUrl: "", mobileImageUrl: "" });
      next[slot] = { ...next[slot], categoryId, [device === "mobile" ? "mobileImageUrl" : "imageUrl"]: publicUrl };
      const { error: settingError } = await supabase.from("site_settings").upsert({
        key: "category_feature_banners",
        value: JSON.stringify(next),
        updated_at: new Date().toISOString(),
      });
      if (settingError) throw settingError;
      setCategoryFeatureBanners(next);
      setNotice(`Banner destacado ${slot + 1} para ${device === "mobile" ? "móvil" : "escritorio"} actualizado`);
    } catch (featureError) {
      setError(featureError instanceof Error ? featureError.message : "No fue posible guardar el banner destacado");
    } finally {
      setLoading(false);
    }
  }

  async function saveHomepageStructure(e: FormEvent) {
    e.preventDefault();
    if (!seasonalCategoryId) return setError("Selecciona la categoría de temporada");
    if (instagramUrl && !/^https:\/\/(www\.)?instagram\.com\//i.test(instagramUrl)) return setError("Ingresa una URL válida de Instagram");
    setLoading(true); setError("");
    const { error } = await supabase.from("site_settings").upsert([
      { key: "seasonal_category_id", value: seasonalCategoryId, updated_at: new Date().toISOString() },
      { key: "instagram_url", value: instagramUrl.trim(), updated_at: new Date().toISOString() },
    ]);
    setLoading(false);
    if (error) setError(error.message); else setNotice("Estructura de la portada actualizada");
  }

  if (!ready)
    return (
      <main className="admin-login">
        <p>Cargando…</p>
      </main>
    );
  if (!signedIn)
    return (
      <main className="admin-login">
        <section className="login-card">
          <Image
            className="login-logo"
            src="/galletisima-logo.png"
            alt="Galletísima"
            width={420}
            height={128}
            priority
          />
          <div className="login-heading">
            <h1>Bienvenida de vuelta</h1>
            <p>Ingresa a tu panel de administración</p>
          </div>
          <form className="login-form" onSubmit={login}>
            <label>Correo electrónico</label>
            <input
              name="email"
              type="email"
              placeholder="hola@galletisima.cl"
              required
            />
            <div className="password-label">
              <label>Contraseña</label>
              <a href="#recuperar">¿La olvidaste?</a>
            </div>
            <div className="password-field">
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="login-submit" disabled={loading}>
              {loading ? "Ingresando…" : "Ingresar al panel"}
              <span>→</span>
            </button>
          </form>
        </section>
      </main>
    );

  const quickActions = (
    <div className="admin-quick-actions">
      <a href="/" target="_blank" rel="noreferrer">
        ⌂ <span>Ver tienda</span>
      </a>
      <button onClick={logout}>
        ↪ <span>Cerrar sesión</span>
      </button>
    </div>
  );

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Image
          src="/galletisima-logo.png"
          alt="Galletísima"
          width={190}
          height={58}
        />
        <nav>
          {nav.map(([icon, label]) => (
            <button
              key={label}
              className={view === label ? "active" : ""}
              onClick={() => setView(label)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <span>AD</span>
          <div>
            <strong>Administración</strong>
            <small>Supabase Auth</small>
          </div>
          <button onClick={logout}>↪</button>
        </div>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <p>Panel de administración</p>
            <h1>
              {view} <span>♡</span>
            </h1>
          </div>
          <div className="top-actions">
            {quickActions}
            <button
              className="new-product"
              onClick={() => {
                setSelectedImages([]);
                setEditing({ ...emptyProduct });
                setView("Productos");
              }}
            >
              ＋ Nuevo producto
            </button>
          </div>
        </header>
        {(error || notice) && (
          <div className="admin-message-backdrop">
            <section
              className={`admin-message-modal ${error ? "error" : "success"}`}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="admin-message-title"
              aria-describedby="admin-message-copy"
            >
              <span className="admin-message-icon" aria-hidden="true">{error ? "!" : "✓"}</span>
              <h2 id="admin-message-title">{error ? "Ocurrió un problema" : "Operación exitosa"}</h2>
              <p id="admin-message-copy">{error || notice}</p>
              <button autoFocus onClick={() => { setError(""); setNotice(""); }}>Aceptar</button>
            </section>
          </div>
        )}
        {view === "Resumen" && (
          <Dashboard products={products} categories={categories} />
        )}{" "}
        {view === "Productos" && (
          <><AdminProductCsvImporter loading={loading} onImport={importCsvProducts} /><Products
              products={products}
              categories={categories}
              edit={(p) => {
                setSelectedImages([]);
                setEditing({ ...p });
              }}
              remove={deleteProduct}
            /></>
        )}{" "}
        {view === "Categorías" && (
          <Categories
            categories={categories}
            products={products}
            name={categoryName}
            setName={setCategoryName}
            add={addCategory}
            remove={deleteCategory}
            navigation={navigationConfig}
            saveNavigation={saveNavigation}
            loading={loading}
            desktopImages={categoryBannerUrls}
            mobileImages={categoryMobileBannerUrls}
            saveCategoryImage={saveCategoryResponsiveImage}
          />
        )}{" "}
        {view === "Banners" && (
          <Banners
            currentUrl={heroBannerUrl}
            currentMobileUrl={heroMobileBannerUrl}
            selectedImage={selectedBanner}
            setSelectedImage={setSelectedBanner}
            selectedMobileImage={selectedMobileBanner}
            setSelectedMobileImage={setSelectedMobileBanner}
            saveDesktop={(event) => saveHeroBanner(event, "desktop")}
            saveMobile={(event) => saveHeroBanner(event, "mobile")}
            heroContent={heroContent}
            setHeroContent={setHeroContent}
            saveHeroContent={saveHeroContent}
            loading={loading}
            categories={categories}
            featureBanners={categoryFeatureBanners}
            saveFeatureBanner={saveCategoryFeatureBanner}
            seasonalCategoryId={seasonalCategoryId}
            setSeasonalCategoryId={setSeasonalCategoryId}
            instagramUrl={instagramUrl}
            setInstagramUrl={setInstagramUrl}
            saveHomepageStructure={saveHomepageStructure}
          />
        )}{" "}
        {view === "Configuración" && (
          <Settings
            whatsappNumber={whatsappNumber}
            setWhatsappNumber={setWhatsappNumber}
            facebookUrl={facebookUrl}
            setFacebookUrl={setFacebookUrl}
            save={saveSettings}
            loading={loading}
          />
        )}{" "}
        {!["Resumen", "Productos", "Categorías", "Banners", "Configuración"].includes(
          view,
        ) && (
          <section className="panel empty-state">
            <h2>{view}</h2>
            <p>
              La estructura de datos ya está preparada. Este módulo se conectará
              en la siguiente iteración.
            </p>
          </section>
        )}
      </section>
      {editing && (
        <ProductModal
          product={editing}
          setProduct={setEditing}
          categories={categories}
          save={saveProduct}
          close={() => {
            setSelectedImages([]);
            setEditing(null);
          }}
          loading={loading}
          selectedImages={selectedImages}
          setSelectedImages={setSelectedImages}
        />
      )}
    </main>
  );
}

function Dashboard({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  return (
    <>
      <div className="metric-grid">
        {[
          [
            "◇",
            "Productos activos",
            products.filter((p) => p.active).length,
            "Catálogo publicado",
            "pink",
          ],
          ["□", "Productos totales", products.length, "productos registrados", "peach"],
          [
            "♧",
            "Categorías",
            categories.length,
            "colecciones creadas",
            "lilac",
          ],
          ["★", "Destacados", products.filter((p) => p.featured).length, "en los más vendidos", "mint"],
        ].map(([i, l, v, c, t]) => (
          <article key={String(l)}>
            <span className={`metric-icon ${t}`}>{i}</span>
            <div>
              <p>{l}</p>
              <h2>{v}</h2>
              <small>{c}</small>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function Products({
  products,
  categories,
  edit,
  remove,
}: {
  products: Product[];
  categories: Category[];
  edit: (p: Product) => void;
  remove: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("es-CL");
  const visibleProducts = normalizedSearch
    ? products.filter((product) => {
        const categoryNames = product.category_ids
          .map((id) => categories.find((category) => category.id === id)?.name || "")
          .join(" ");
        return `${product.name} ${product.sku} ${categoryNames}`.toLocaleLowerCase("es-CL").includes(normalizedSearch);
      })
    : products;
  return (
    <section className="panel orders-panel">
      <div className="panel-title">
        <div>
          <h2>Catálogo</h2>
          <p>{normalizedSearch ? `${visibleProducts.length} de ${products.length} productos` : `${products.length} productos registrados`}</p>
        </div>
        <label className="product-admin-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nombre, SKU o categoría…" aria-label="Buscar productos" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">×</button>}
        </label>
      </div>
      <div className="orders-table">
        <div className="order-row product-row order-head">
          <span>Producto</span>
          <span>SKU</span>
          <span>Categorías</span>
          <span>Precio</span>
          <span />
        </div>
        {visibleProducts.map((p) => (
          <div className="order-row product-row" key={p.id}>
            <div className="product-table-name">
              <span className="product-table-thumb">{p.image_url ? <img src={p.image_url} alt="" /> : <span aria-hidden="true">◇</span>}</span>
              <div><strong>{p.name}</strong><small>{p.active ? "Publicado" : "Oculto"}</small></div>
            </div>
            <span>{p.sku}</span>
            <span className="category-cell">
              {p.category_ids
                .map((id) => categories.find((c) => c.id === id)?.name)
                .filter(Boolean)
                .join(", ") || "Sin categoría"}
            </span>
            <strong>
              {p.price ? `$${p.price.toLocaleString("es-CL")}` : "Pendiente"}
            </strong>
            <span className="row-actions">
              <button type="button" className="edit-product" onClick={() => edit(p)} aria-label={`Editar ${p.name}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>
                Editar
              </button>
              <button type="button" className="delete-product" onClick={() => remove(p.id)} aria-label={`Eliminar ${p.name}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>
                Eliminar
              </button>
            </span>
          </div>
        ))}
        {!visibleProducts.length && <div className="product-search-empty"><strong>No encontramos productos</strong><span>Prueba con otro nombre, SKU o categoría.</span><button type="button" onClick={() => setSearch("")}>Limpiar búsqueda</button></div>}
      </div>
    </section>
  );
}
function Categories({
  categories,
  products,
  name,
  setName,
  add,
  remove,
  navigation,
  saveNavigation,
  loading,
  desktopImages,
  mobileImages,
  saveCategoryImage,
}: {
  categories: Category[];
  products: Product[];
  name: string;
  setName: (v: string) => void;
  add: (e: FormEvent) => void;
  remove: (id: string) => void;
  navigation: NavigationConfig;
  saveNavigation: (next: NavigationConfig) => Promise<void>;
  loading: boolean;
  desktopImages: Record<string, string>;
  mobileImages: Record<string, string>;
  saveCategoryImage: (categoryId: string, device: "desktop" | "mobile", file: File) => Promise<void>;
}) {
  const ordered = [...categories].sort((a, b) => {
    const ai = navigation.categoryOrder.indexOf(a.id), bi = navigation.categoryOrder.indexOf(b.id);
    return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi) || a.name.localeCompare(b.name, "es");
  });
  const categorySections = [
    ...navigation.menus.map((menu) => ({
      id: menu.id,
      label: menu.label,
      items: ordered.filter((category) => navigation.categoryMenu[category.id] === menu.id),
    })),
    ...navigation.links.filter((link) => link.id !== "home").map((link) => ({
      id: `link:${link.id}`,
      label: link.label,
      items: ordered.filter((category) => navigation.categoryMenu[category.id] === `link:${link.id}`),
    })),
    {
      id: "unassigned",
      label: "Sin menú",
      items: ordered.filter((category) => !navigation.categoryMenu[category.id] || (![...navigation.menus.map((menu) => menu.id), ...navigation.links.filter((link) => link.id !== "home").map((link) => `link:${link.id}`)].includes(navigation.categoryMenu[category.id]))),
    },
  ].filter((section) => section.items.length > 0);
  const navItems = navigation.itemOrder.map((key) => key.startsWith("menu:")
    ? { key, kind: "menu" as const, item: navigation.menus.find((menu) => `menu:${menu.id}` === key) }
    : { key, kind: "link" as const, item: navigation.links.find((link) => `link:${link.id}` === key) }).filter((entry) => entry.item);
  const moveNavItem = (index: number, direction: number) => {
    const itemOrder = navItems.map((entry) => entry.key), target = index + direction;
    if (target < 0 || target >= itemOrder.length) return;
    [itemOrder[index], itemOrder[target]] = [itemOrder[target], itemOrder[index]];
    void saveNavigation({ ...navigation, itemOrder });
  };
  const moveCategory = (id: string, direction: number) => {
    const menuIds = new Set([...navigation.menus.map((menu) => menu.id), ...navigation.links.filter((link) => link.id !== "home").map((link) => `link:${link.id}`)]);
    const currentMenu = menuIds.has(navigation.categoryMenu[id]) ? navigation.categoryMenu[id] : "";
    const siblings = ordered.filter((category) => {
      const assignedMenu = navigation.categoryMenu[category.id];
      return (menuIds.has(assignedMenu) ? assignedMenu : "") === currentMenu;
    });
    const siblingIndex = siblings.findIndex((category) => category.id === id);
    const targetSibling = siblings[siblingIndex + direction];
    if (siblingIndex < 0 || !targetSibling) return;
    const order = ordered.map((category) => category.id);
    const currentIndex = order.indexOf(id);
    const targetIndex = order.indexOf(targetSibling.id);
    [order[currentIndex], order[targetIndex]] = [order[targetIndex], order[currentIndex]];
    void saveNavigation({ ...navigation, categoryOrder: order });
  };
  return (
    <section className="panel category-panel">
      <div className="category-menu-manager">
        <div className="panel-title"><div><h2>Menú público completo</h2><p>Edita aquí todos los botones y grupos que aparecen en la tienda.</p></div></div>
        <div className="menu-manager-list">
          {navItems.map((entry, index) => {
            const item = entry.item!;
            return <div key={entry.key}>
              <input defaultValue={item.label} onBlur={(event) => { const label = event.target.value.trim(); if (!label || label === item.label) return; entry.kind === "menu" ? void saveNavigation({ ...navigation, menus: navigation.menus.map((menu) => menu.id === item.id ? { ...menu, label } : menu) }) : void saveNavigation({ ...navigation, links: navigation.links.map((link) => link.id === item.id ? { ...link, label } : link) }); }} />
              <button type="button" disabled={loading || index === 0} onClick={() => moveNavItem(index, -1)}>↑</button>
              <button type="button" disabled={loading || index === navItems.length - 1} onClick={() => moveNavItem(index, 1)}>↓</button>
              <button type="button" disabled={loading || entry.kind === "link"} title={entry.kind === "link" ? "Acceso estructural protegido" : "Eliminar menú"} onClick={() => entry.kind === "menu" && void saveNavigation({ ...navigation, menus: navigation.menus.filter((menu) => menu.id !== item.id), itemOrder: navigation.itemOrder.filter((key) => key !== entry.key), categoryMenu: Object.fromEntries(Object.entries(navigation.categoryMenu).filter(([, menuId]) => menuId !== item.id)) })}>Eliminar</button>
            </div>;
          })}
        </div>
        <button className="add-menu" disabled={loading} onClick={() => void saveNavigation({ ...navigation, menus: [...navigation.menus, { id: crypto.randomUUID(), label: `Menú ${navigation.menus.length + 1}` }] })}>＋ Crear menú</button>
      </div>
      <form className="inline-form" onSubmit={add}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva categoría"
          required
        />
        <button>＋ Crear categoría</button>
      </form>
      <div className="category-sections">
        {categorySections.map((section) => (
          <section className="category-section" key={section.id}>
            <header><div><h3>{section.label}</h3><p>Categorías visibles dentro de este menú.</p></div><span>{section.items.length}</span></header>
            <div className="category-admin-grid">
              {section.items.map((c, sectionIndex) => {
                const desktopUrl = desktopImages[c.id];
                const mobileUrl = mobileImages[c.id];
                return <article key={c.id}>
                  <div className="category-card-main">
                    <div className="category-card-info">
                      <strong>{c.name}</strong>
                      <small>{products.filter((p) => p.category_ids.includes(c.id)).length} productos</small>
                    </div>
                    <div className="category-card-controls">
                      <label><span>Menú</span><select value={navigation.categoryMenu[c.id] || ""} onChange={(event) => void saveNavigation({ ...navigation, categoryMenu: { ...navigation.categoryMenu, [c.id]: event.target.value } })}>
                        <option value="">Sin menú</option>
                        <optgroup label="Menús de categorías">
                          {navigation.menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.label}</option>)}
                        </optgroup>
                        <optgroup label="Otros menús públicos">
                          {navigation.links.filter((link) => link.id !== "home").map((link) => <option key={link.id} value={`link:${link.id}`}>{link.label}</option>)}
                        </optgroup>
                      </select></label>
                      <span className="category-order-actions" aria-label="Orden de la categoría"><button type="button" title="Subir categoría" disabled={loading || sectionIndex === 0} onClick={() => moveCategory(c.id, -1)}>↑</button><button type="button" title="Bajar categoría" disabled={loading || sectionIndex === section.items.length - 1} onClick={() => moveCategory(c.id, 1)}>↓</button></span>
                      <button className="category-delete" type="button" onClick={() => remove(c.id)}>Eliminar</button>
                    </div>
                  </div>
                  <details className="category-media">
                    <summary>Fotos de categoría <span>{desktopUrl || mobileUrl ? "Configuradas" : "Sin fotos"}</span></summary>
                    <div className="category-device-images">
                      {(["desktop", "mobile"] as const).map((device) => {
                        const url = device === "desktop" ? desktopUrl : mobileUrl;
                        return <label className={`category-device-upload ${device}`} key={device}>
                          <span className="category-device-preview" style={url ? { backgroundImage: `url(${url})` } : undefined}>{!url && (device === "desktop" ? "Escritorio" : "Celular")}</span>
                          <b>{url ? "Cambiar" : "Subir"} foto {device === "desktop" ? "escritorio" : "celular"}</b>
                          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void saveCategoryImage(c.id, device, file); event.currentTarget.value = ""; }} />
                        </label>;
                      })}
                    </div>
                  </details>
                </article>;
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
function Banners({
  currentUrl,
  currentMobileUrl,
  selectedImage,
  setSelectedImage,
  selectedMobileImage,
  setSelectedMobileImage,
  saveDesktop,
  saveMobile,
  heroContent,
  setHeroContent,
  saveHeroContent,
  loading,
  categories,
  featureBanners,
  saveFeatureBanner,
  seasonalCategoryId,
  setSeasonalCategoryId,
  instagramUrl,
  setInstagramUrl,
  saveHomepageStructure,
}: {
  currentUrl: string;
  currentMobileUrl: string;
  selectedImage: File | null;
  setSelectedImage: (file: File | null) => void;
  selectedMobileImage: File | null;
  setSelectedMobileImage: (file: File | null) => void;
  saveDesktop: (e: FormEvent) => void;
  saveMobile: (e: FormEvent) => void;
  heroContent: HeroContent;
  setHeroContent: (value: HeroContent) => void;
  saveHeroContent: (e: FormEvent) => void;
  loading: boolean;
  categories: Category[];
  featureBanners: CategoryFeatureBanner[];
  saveFeatureBanner: (slot: number, categoryId: string, device: "desktop" | "mobile", file: File) => Promise<void>;
  seasonalCategoryId: string;
  setSeasonalCategoryId: (value: string) => void;
  instagramUrl: string;
  setInstagramUrl: (value: string) => void;
  saveHomepageStructure: (event: FormEvent) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState("");
  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);
  const preview = previewUrl || currentUrl || "/hero-cookies.webp";
  useEffect(() => {
    if (!selectedMobileImage) { setMobilePreviewUrl(""); return; }
    const url = URL.createObjectURL(selectedMobileImage);
    setMobilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedMobileImage]);
  const mobilePreview = mobilePreviewUrl || currentMobileUrl || currentUrl || "/hero-cookies.webp";
  const [featureCategories, setFeatureCategories] = useState<string[]>(["", "", ""]);
  useEffect(() => {
    setFeatureCategories(Array.from({ length: 3 }, (_, index) => featureBanners[index]?.categoryId || ""));
  }, [featureBanners]);
  return (
    <section className="panel banner-panel">
      <header className="banner-page-intro">
        <div>
          <span>Contenido visual</span>
          <h2>Administra las imágenes de la tienda</h2>
          <p>Elige qué sección quieres editar. Las imágenes se optimizan automáticamente al guardarlas.</p>
        </div>
      </header>

      <section className="banner-editor-card banner-editor-primary">
        <div className="banner-editor-heading">
          <span className="banner-step">1</span>
          <div>
            <h3>Portada principal</h3>
            <p>Es la imagen grande que recibe a tus clientes al entrar.</p>
          </div>
        </div>
        <form className="hero-content-form" onSubmit={saveHeroContent}>
          <label><span>Sobretítulo</span><input value={heroContent.eyebrow} onChange={(event) => setHeroContent({ ...heroContent, eyebrow: event.target.value })} maxLength={80} required /></label>
          <label className="wide"><span>Título principal</span><input value={heroContent.title} onChange={(event) => setHeroContent({ ...heroContent, title: event.target.value })} maxLength={140} required /></label>
          <label className="wide"><span>Subtítulo</span><textarea value={heroContent.subtitle} onChange={(event) => setHeroContent({ ...heroContent, subtitle: event.target.value })} maxLength={260} required /></label>
          <label><span>Botón 1</span><input value={heroContent.primaryButton} onChange={(event) => setHeroContent({ ...heroContent, primaryButton: event.target.value })} maxLength={40} required /></label>
          <label><span>Botón 2</span><input value={heroContent.secondaryButton} onChange={(event) => setHeroContent({ ...heroContent, secondaryButton: event.target.value })} maxLength={40} required /></label>
          <button className="banner-save" disabled={loading}>{loading ? "Guardando…" : "Guardar textos"}</button>
        </form>
        <div className="responsive-banner-grid">
          <form className="responsive-banner-card desktop" onSubmit={saveDesktop}>
            <div className="banner-preview" style={{ backgroundImage: `url(${preview})` }}><span>Escritorio</span></div>
            <label className="banner-file-control"><strong>{selectedImage ? selectedImage.name : "Seleccionar imagen de escritorio"}</strong><small>Horizontal · recomendado 1920 × 900 px</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setSelectedImage(e.target.files?.[0] || null)} /></label>
            <button className="banner-save" disabled={loading || !selectedImage}>{loading ? "Guardando…" : "Guardar escritorio"}</button>
          </form>
          <form className="responsive-banner-card mobile" onSubmit={saveMobile}>
            <div className="banner-preview" style={{ backgroundImage: `url(${mobilePreview})` }}><span>Móvil</span></div>
            <label className="banner-file-control"><strong>{selectedMobileImage ? selectedMobileImage.name : "Seleccionar imagen móvil"}</strong><small>Vertical · recomendado 900 × 1200 px</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setSelectedMobileImage(e.target.files?.[0] || null)} /></label>
            <button className="banner-save" disabled={loading || !selectedMobileImage}>{loading ? "Guardando…" : "Guardar móvil"}</button>
          </form>
        </div>
      </section>

      <details className="banner-editor-card banner-collapsible" open>
        <summary>
          <span className="banner-step">2</span>
          <div>
            <h3>Destacados de categorías</h3>
            <p>Configura los 3 banners grandes que aparecen después del carrusel.</p>
          </div>
          <span className="banner-open-label">Administrar</span>
        </summary>
        <div className="feature-banner-admin-list">
          {[0, 1, 2].map((slot) => (
            <article key={slot}>
              <div className="feature-device-previews">
                <div className="feature-device-preview-card desktop">
                  <div className="feature-banner-admin-preview" style={featureBanners[slot]?.imageUrl ? { backgroundImage: `url(${featureBanners[slot].imageUrl})` } : undefined}>
                    <span>Escritorio</span>
                    {!featureBanners[slot]?.imageUrl && <strong>Sin imagen de escritorio</strong>}
                  </div>
                  <small>Vista horizontal</small>
                </div>
                <div className="feature-device-preview-card mobile">
                  <div className="feature-banner-admin-preview mobile" style={(featureBanners[slot]?.mobileImageUrl || featureBanners[slot]?.imageUrl) ? { backgroundImage: `url(${featureBanners[slot]?.mobileImageUrl || featureBanners[slot]?.imageUrl})` } : undefined}>
                    <span>Móvil</span>
                    {!featureBanners[slot]?.mobileImageUrl && <strong>{featureBanners[slot]?.imageUrl ? "Usará la imagen de escritorio" : "Sin imagen móvil"}</strong>}
                  </div>
                  <small>Vista vertical en celulares</small>
                </div>
              </div>
              <div>
                <label>
                  <span>Categoría vinculada</span>
                  <select
                    value={featureCategories[slot] || ""}
                    onChange={(event) => setFeatureCategories((current) => current.map((value, index) => index === slot ? event.target.value : value))}
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <div className="feature-upload-pair">{(["desktop", "mobile"] as const).map((device) => <label className={`feature-upload ${!featureCategories[slot] ? "disabled" : ""}`} key={device}>
                  {device === "desktop" ? "Imagen escritorio" : "Imagen móvil"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={loading || !featureCategories[slot]} onChange={(event) => { const file = event.target.files?.[0]; if (file && featureCategories[slot]) void saveFeatureBanner(slot, featureCategories[slot], device, file); event.currentTarget.value = ""; }} />
                </label>)}</div>
              </div>
            </article>
          ))}
        </div>
      </details>

      <section className="banner-editor-card">
        <div className="banner-editor-heading"><span className="banner-step">3</span><div><h3>Temporada e Instagram</h3><p>Elige qué colección encabeza la temporada y conecta el perfil social.</p></div></div>
        <form className="homepage-structure-form" onSubmit={saveHomepageStructure}>
          <label><span>Categoría de temporada</span><select value={seasonalCategoryId} onChange={(event) => setSeasonalCategoryId(event.target.value)} required><option value="">Seleccionar categoría</option>{categories.filter((category) => !/^AA-Prueba/i.test(category.name)).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small>La portada mostrará un carrusel con todos sus productos.</small></label>
          <label><span>Perfil de Instagram</span><input type="url" value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="https://www.instagram.com/tu-cuenta/" /><small>Se mostrará un acceso directo; no requiere entregar contraseñas.</small></label>
          <button className="banner-save" disabled={loading}>{loading ? "Guardando…" : "Guardar estructura"}</button>
        </form>
      </section>
    </section>
  );
}

function Settings({
  whatsappNumber,
  setWhatsappNumber,
  facebookUrl,
  setFacebookUrl,
  save,
  loading,
}: {
  whatsappNumber: string;
  setWhatsappNumber: (v: string) => void;
  facebookUrl: string;
  setFacebookUrl: (v: string) => void;
  save: (e: FormEvent) => void;
  loading: boolean;
}) {
  return (
    <section className="panel settings-panel">
      <div className="panel-title">
        <div>
          <h2>Contacto por WhatsApp</h2>
          <p>Este número se utiliza en el botón flotante del sitio público.</p>
        </div>
      </div>
      <form className="settings-form" onSubmit={save}>
        <label>
          Número de WhatsApp
          <span>Formato internacional, sin +, espacios ni guiones.</span>
          <input
            inputMode="numeric"
            value={whatsappNumber}
            onChange={(e) =>
              setWhatsappNumber(e.target.value.replace(/\D/g, ""))
            }
            placeholder="56975265959"
            maxLength={11}
            required
          />
        </label>
        <label>
          Página de Facebook
          <span>Enlace público que se mostrará en el footer de la tienda.</span>
          <input
            type="url"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            placeholder="https://www.facebook.com/galletisima"
            required
          />
        </label>
        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noreferrer"
        >
          Probar enlace
        </a>
        <button disabled={loading}>
          {loading ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </section>
  );
}
function ProductModal({
  product,
  setProduct,
  categories,
  save,
  close,
  loading,
  selectedImages,
  setSelectedImages,
}: {
  product: typeof emptyProduct;
  setProduct: (p: typeof emptyProduct) => void;
  categories: Category[];
  save: (e: FormEvent<HTMLFormElement>) => void;
  close: () => void;
  loading: boolean;
  selectedImages: File[];
  setSelectedImages: (files: File[]) => void;
}) {
  const field =
    (key: keyof typeof product) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setProduct({
        ...product,
        [key]:
          e.target.type === "number" ? Number(e.target.value) : e.target.value,
      });
  const toggle = (id: string) =>
    setProduct({
      ...product,
      category_ids: product.category_ids.includes(id)
        ? product.category_ids.filter((x) => x !== id)
        : [...product.category_ids, id],
    });
  const selectedPreviews = useMemo(
    () => selectedImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [selectedImages],
  );
  const gallery = [...product.image_urls.map((url) => ({ url, existing: true })), ...selectedPreviews.map(({ url }) => ({ url, existing: false }))];
  const [variants, setVariants] = useState(() => buildSizeVariants(product.size, product.size_prices, product.price));
  const updateVariants = (next: { size: string; price: number }[]) => {
    setVariants(next);
    setProduct({
      ...product,
      size: next.map((variant) => variant.size.trim()).filter(Boolean).join(", "),
      size_prices: next.filter((variant) => variant.size.trim() && variant.price > 0).map((variant) => `${variant.size.trim()}: ${variant.price}`).join(", "),
      price: next.find((variant) => variant.price > 0)?.price || product.price,
    });
  };
  useEffect(() => () => selectedPreviews.forEach(({ url }) => URL.revokeObjectURL(url)), [selectedPreviews]);
  return (
    <div className="modal-backdrop">
      <form className="product-modal" onSubmit={save}>
        <div className="modal-title">
          <div>
            <h2>{product.id ? "Editar producto" : "Nuevo producto"}</h2>
            <p>Completa la información del catálogo.</p>
          </div>
          <button type="button" onClick={close}>
            ×
          </button>
        </div>
        <div className="modal-grid">
          <label>
            Nombre
            <input value={product.name} onChange={field("name")} required />
          </label>
          <label>
            SKU
            <input
              value={product.sku}
              onChange={(e) =>
                setProduct({ ...product, sku: cleanSku(e.target.value) })
              }
              pattern="[A-Z0-9]+"
              title="Solo letras mayúsculas y números"
              placeholder="GAL0001"
              required
            />
          </label>
          <fieldset className="wide variant-editor" aria-labelledby="variant-editor-title">
            <div className="variant-editor-heading">
              <div><strong id="variant-editor-title">Tamaños y precios</strong><small>Agrega cada medida con su precio de venta.</small></div>
              <button type="button" onClick={() => updateVariants([...variants, { size: "", price: 0 }])}>＋ Agregar tamaño</button>
            </div>
            <div className="variant-list">
              {variants.map((variant, index) => (
                <div className="variant-row" key={index}>
                  <label>Medida<input value={variant.size} placeholder="Ej. 8 cm" onChange={(event) => updateVariants(variants.map((item, itemIndex) => itemIndex === index ? { ...item, size: event.target.value } : item))} required /></label>
                  <label>Precio<input type="number" min="0" step="1" value={variant.price || ""} placeholder="$ 0" onChange={(event) => updateVariants(variants.map((item, itemIndex) => itemIndex === index ? { ...item, price: Number(event.target.value) } : item))} required /></label>
                  <button type="button" aria-label={`Eliminar tamaño ${index + 1}`} disabled={variants.length === 1} onClick={() => updateVariants(variants.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                </div>
              ))}
            </div>
          </fieldset>
          <label className="wide featured-toggle">
            <input
              type="checkbox"
              checked={product.featured}
              onChange={(e) =>
                setProduct({ ...product, featured: e.target.checked })
              }
            />
            <span>
              Mostrar en “Los más vendidos”
              <small>El producto aparecerá en la sección destacada de la tienda.</small>
            </span>
          </label>
          <label className="wide">
            Descripción
            <textarea
              value={product.description}
              onChange={field("description")}
            />
          </label>
          <div className="wide product-gallery-editor">
            <div className="gallery-editor-heading"><span>Fotos del producto</span><strong>{gallery.length}/8</strong></div>
            <label className="image-picker">
            <span>Seleccionar varias fotos</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={gallery.length >= 8}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setSelectedImages([...selectedImages, ...files].slice(0, Math.max(0, 8 - product.image_urls.length)));
                e.target.value = "";
              }}
            />
            <small>
              Selecciona varias imágenes en una sola vez. Hasta 8 fotos; se optimizan automáticamente a WebP y la primera será la portada.
            </small>
            </label>
            {gallery.length ? <div className="gallery-preview-grid">{gallery.map((image, index) => (
              <article key={`${image.url}-${index}`}>
                <img src={image.url} alt={`Foto ${index + 1} del producto`} />
                {index === 0 && <span>Portada</span>}
                <button type="button" aria-label={`Quitar foto ${index + 1}`} onClick={() => image.existing
                  ? setProduct({ ...product, image_urls: product.image_urls.filter((url) => url !== image.url) })
                  : setSelectedImages(selectedImages.filter((_, fileIndex) => fileIndex !== index - product.image_urls.length))}>×</button>
              </article>
            ))}</div> : <p className="gallery-empty">Aún no hay fotos cargadas.</p>}
          </div>
          <fieldset className="wide category-picker">
            <legend>Categorías · selecciona al menos una</legend>
            {categories.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={product.category_ids.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
                {c.name}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="save" disabled={loading}>
            {loading ? "Comprimiendo y guardando…" : "Guardar producto"}
          </button>
        </div>
      </form>
    </div>
  );
}
async function compressProductImage(file: File) {
  if (!file.type.startsWith("image/"))
    throw new Error("Selecciona una imagen JPG, PNG o WebP");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("La foto original no puede superar 20 MB");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  // 2000 px conserva textos y detalles finos sin enviar originales pesados al bucket.
  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    bitmap.close();
    throw new Error("No fue posible procesar la imagen");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let quality = 0.92;
  let blob: Blob | null = null;
  do {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    quality -= 0.04;
  } while (blob && blob.size > 2 * 1024 * 1024 && quality >= 0.8);
  if (!blob) throw new Error("No fue posible comprimir la imagen");
  return blob;
}
async function compressBannerImage(file: File) {
  if (!file.type.startsWith("image/"))
    throw new Error("Selecciona una imagen JPG, PNG o WebP");
  if (file.size > 25 * 1024 * 1024)
    throw new Error("La imagen original no puede superar 25 MB");
  const bitmap = await createImageBitmap(file);
  const maxWidth = 2400;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("No fue posible procesar la imagen");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  );
  if (!blob) throw new Error("No fue posible comprimir la imagen");
  return blob;
}
async function compressCategoryImage(file: File) {
  if (!file.type.startsWith("image/"))
    throw new Error("Selecciona una imagen JPG, PNG o WebP");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("La imagen original no puede superar 20 MB");
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sourceX = Math.round((bitmap.width - side) / 2);
  const sourceY = Math.round((bitmap.height - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("No fue posible procesar la imagen");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, 900, 900);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  if (!blob) throw new Error("No fue posible comprimir la imagen");
  return blob;
}
async function compressCategoryMobileImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona una imagen JPG, PNG o WebP");
  if (file.size > 20 * 1024 * 1024) throw new Error("La imagen original no puede superar 20 MB");
  const bitmap = await createImageBitmap(file);
  const targetRatio = 4 / 5;
  let sourceWidth = bitmap.width, sourceHeight = Math.round(sourceWidth / targetRatio);
  if (sourceHeight > bitmap.height) { sourceHeight = bitmap.height; sourceWidth = Math.round(sourceHeight * targetRatio); }
  const sourceX = Math.round((bitmap.width - sourceWidth) / 2), sourceY = Math.round((bitmap.height - sourceHeight) / 2);
  const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 1000;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("No fue posible procesar la imagen"); }
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 800, 1000); bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  if (!blob) throw new Error("No fue posible comprimir la imagen"); return blob;
}
async function compressFeatureBannerImage(file: File) {
  if (!file.type.startsWith("image/"))
    throw new Error("Selecciona una imagen JPG, PNG o WebP");
  if (file.size > 25 * 1024 * 1024)
    throw new Error("La imagen original no puede superar 25 MB");
  const bitmap = await createImageBitmap(file);
  const targetRatio = 2.4;
  let sourceWidth = bitmap.width;
  let sourceHeight = Math.round(sourceWidth / targetRatio);
  if (sourceHeight > bitmap.height) {
    sourceHeight = bitmap.height;
    sourceWidth = Math.round(sourceHeight * targetRatio);
  }
  const sourceX = Math.round((bitmap.width - sourceWidth) / 2);
  const sourceY = Math.round((bitmap.height - sourceHeight) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 800;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("No fue posible procesar la imagen");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 1920, 800);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("No fue posible comprimir la imagen");
  return blob;
}
function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function cleanSku(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
function normalizeSizes(value: string) {
  const sizes = value
    .split(/[,;\n]+/)
    .map((size) => size.trim())
    .filter(Boolean)
    .map((size) => (/^\d+(?:[.,]\d+)?$/.test(size) ? `${size} cm` : size));
  return [...new Set(sizes)].join(", ");
}
function parseSizePrices(value: string) {
  return Object.fromEntries(value.split(/[,;\n]+/).map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [size, rawPrice] = entry.split(":").map((part) => part.trim());
    const normalizedSize = /^\d+(?:[.,]\d+)?$/.test(size) ? `${size} cm` : size;
    return [normalizedSize, Number(rawPrice?.replace(/[^0-9]/g, "")) || 0];
  }).filter(([size, price]) => size && Number(price) > 0));
}
function formatSizePrices(prices: Record<string, number>) {
  return Object.entries(prices).map(([size, price]) => `${size}: ${price}`).join(", ");
}
function buildSizeVariants(sizesValue: string, pricesValue: string, fallbackPrice: number) {
  const prices = parseSizePrices(pricesValue);
  const sizes = sizesValue.split(/[,;\n]+/).map((size) => size.trim()).filter(Boolean);
  if (!sizes.length) return [{ size: "", price: fallbackPrice || 0 }];
  return sizes.map((size, index) => ({ size, price: prices[size] || (index === 0 ? fallbackPrice : 0) }));
}
