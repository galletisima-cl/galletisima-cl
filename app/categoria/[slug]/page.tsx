"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ProductBenefitsFaq from "../../../components/ProductBenefitsFaq";
import PublicHeader from "../../../components/PublicHeader";
import { productDisplayPrice } from "../../../lib/product-price";
import { createClient } from "../../../lib/supabase/client";
import { useGaSearch } from "../../../lib/use-ga-search";

type Category = { id: string; name: string; slug: string };
type CategoryProduct = {
  id: string;
  slug: string;
  name: string;
  size: string;
  price: number;
  image_url: string;
  featured: boolean;
};

const PAGE_SIZE = 50;

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function displayCategory(name: string) {
  return name.replace(/^todo\s+/i, "");
}

function readSlug(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value || "";
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const slug = readSlug(params?.slug);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<CategoryProduct[]>([]);
  const [search, setSearch] = useState("");
  useGaSearch(search, "categoria");
  const [sort, setSort] = useState("name-asc");
  const [page, setPage] = useState(1);
  const gridTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: found } = await supabase.from("categories").select("id,name,slug").eq("active", true).eq("slug", slug).maybeSingle();
      if (cancelled) return;
      if (!found) { setStatus("missing"); return; }
      const [productsResult, settingsResult] = await Promise.all([
        supabase
          .from("products")
          .select("id,slug,name,size,price,image_url,featured,product_categories!inner(category_id)")
          .eq("active", true)
          .eq("product_categories.category_id", found.id)
          .order("name"),
        supabase.from("site_settings").select("value").eq("key", "product_size_prices").maybeSingle(),
      ]);
      if (cancelled) return;
      let configuredPrices: Record<string, Record<string, number>> = {};
      try { configuredPrices = JSON.parse(settingsResult.data?.value || "{}"); } catch { configuredPrices = {}; }
      setCategory(found);
      setProducts((productsResult.data || []).map((product) => ({
        id: product.id, slug: product.slug, name: product.name, size: product.size,
        image_url: product.image_url, featured: product.featured,
        price: productDisplayPrice(product, configuredPrices),
      })));
      setStatus("ready");
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (category) document.title = `${displayCategory(category.name)} | Galletísima`;
  }, [category]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return products
      .filter((product) => !term || product.name.toLocaleLowerCase("es").includes(term))
      .sort((a, b) => {
        if (sort === "price-asc") return a.price - b.price;
        if (sort === "price-desc") return b.price - a.price;
        if (sort === "name-desc") return b.name.localeCompare(a.name, "es");
        return a.name.localeCompare(b.name, "es");
      });
  }, [products, search, sort]);

  const pageCount = Math.max(1, Math.ceil(visibleProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageProducts = visibleProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const goToPage = (next: number) => {
    setPage(Math.max(1, Math.min(next, pageCount)));
    gridTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (status === "missing") {
    return <main>
      <PublicHeader />
      <section className="section shell">
        <p className="eyebrow catalog-eyebrow">CATEGORÍA</p>
        <h2>No encontramos esta categoría</h2>
        <div className="title-line" />
        <div className="catalog-loader"><span>Puede que ya no exista o que el enlace esté incompleto.</span></div>
        <nav className="catalog-pagination" aria-label="Volver"><Link href="/?ver=todos#catalogo">Ver todos los productos →</Link></nav>
      </section>
    </main>;
  }

  return <main>
    <PublicHeader />
    <section className="section catalog-section shell">
      <p className="eyebrow catalog-eyebrow">COLECCIÓN</p>
      <h1 style={{ margin: 0, textAlign: "center", fontSize: 28 }}>{category ? displayCategory(category.name) : "Cargando…"}</h1>
      <div className="title-line" />
      <div ref={gridTop} />
      {status === "loading" ? <div className="catalog-loader"><span>Cargando productos…</span></div> : <>
        <div className="catalog-filters">
          <label className="catalog-search"><span>Buscar en {category ? displayCategory(category.name) : "la categoría"}</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nombre del molde…" /></label>
          <label><span>Ordenar</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="name-asc">Nombre A–Z</option><option value="name-desc">Nombre Z–A</option><option value="price-asc">Precio menor a mayor</option><option value="price-desc">Precio mayor a menor</option></select></label>
          <Link className="button secondary" href="/?ver=todos#catalogo">Ver todo el catálogo</Link>
        </div>
        <p className="catalog-count">{visibleProducts.length} {visibleProducts.length === 1 ? "producto" : "productos"}</p>
        <div className="product-grid">
          {pageProducts.map((product, productIndex) => <article className="product-card" key={product.id}>
            <Link className={`product-photo ${product.image_url ? "has-product-image" : ""}`} href={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>
              {product.image_url && <img src={product.image_url} alt="" loading={productIndex < 4 ? "eager" : "lazy"} decoding="async" />}
              {product.featured && <span className="tag">favorito</span>}
            </Link>
            <div className="product-info">
              <div><h3><Link href={`/producto/${product.slug}`}>{product.name}</Link></h3><strong>{product.price ? currency.format(product.price) : "Consultar"}</strong></div>
              <Link className="product-buy" href={`/producto/${product.slug}`} aria-label={`Comprar ${product.name}`}>Comprar</Link>
            </div>
          </article>)}
        </div>
        {visibleProducts.length > 0
          ? pageCount > 1 && <nav className="catalog-pagination" aria-label="Páginas de la categoría"><button type="button" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>← Anterior</button><span>Página <b>{currentPage}</b> de {pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => goToPage(currentPage + 1)}>Siguiente →</button></nav>
          : <div className="catalog-loader"><span>No encontramos productos con estos filtros.</span></div>}
      </>}
    </section>
    <ProductBenefitsFaq />
  </main>;
}
