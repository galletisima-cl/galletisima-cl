import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PublicHeader from "../../../components/PublicHeader";

type PageProps = { params: Promise<{ slug: string }> };
type Product = { id: string; slug: string; name: string; price: number; image_url: string; featured: boolean };

const currency = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

async function getCategory(slug: string) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: category } = await supabase.from("categories").select("id,name,slug,description").eq("slug", slug).eq("active", true).maybeSingle();
  if (!category) return null;
  const { data: products } = await supabase
    .from("products")
    .select("id,slug,name,price,image_url,featured,product_categories!inner(category_id)")
    .eq("active", true)
    .eq("product_categories.category_id", category.id)
    .order("name");
  return { category, products: (products || []) as Product[] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCategory(decodeURIComponent(slug));
  return result ? { title: `${result.category.name} | Galletísima`, description: result.category.description || `Todos los moldes de ${result.category.name}.` } : { title: "Categoría | Galletísima" };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getCategory(decodeURIComponent(slug));
  if (!result) notFound();
  const title = result.category.name.replace(/^Todo\s+/i, "");
  return <main className="category-page">
    <PublicHeader />
    <section className="category-page-heading shell">
      <Link href="/">← Volver al inicio</Link>
      <p className="eyebrow">COLECCIÓN</p>
      <h1>{title}</h1>
      {result.category.description && <p>{result.category.description}</p>}
      <span>{result.products.length} {result.products.length === 1 ? "producto" : "productos"}</span>
    </section>
    <section className="category-page-products shell" aria-label={`Productos de ${title}`}>
      {result.products.length ? <div className="product-grid">{result.products.map((product) => <article className="product-card" key={product.id}>
        <Link className={`product-photo ${product.image_url ? "has-product-image" : ""}`} href={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`} style={{ backgroundImage: product.image_url ? `url(${product.image_url})` : undefined }}>{product.featured && <span className="tag">favorito</span>}</Link>
        <div className="product-info"><div><h3><Link href={`/producto/${product.slug}`}>{product.name}</Link></h3><strong>{product.price ? currency.format(product.price) : "Consultar"}</strong></div><Link className="product-buy" href={`/producto/${product.slug}`}>Comprar</Link></div>
      </article>)}</div> : <div className="category-empty"><h2>Aún no hay productos en esta categoría</h2><Link className="button primary" href="/?ver=todos#catalogo">Ver catálogo completo</Link></div>}
    </section>
  </main>;
}
