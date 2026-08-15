"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CartDrawer from "../components/CartDrawer";
import MobileCategoryAccordions from "../components/MobileCategoryAccordions";
import { createClient } from "../lib/supabase/client";
import { CART_UPDATED_EVENT, readCartCount } from "../lib/cart";

type Category = { id: string; name: string; slug: string };

const fallbackCategories: Category[] = [
  { id: "navidad", name: "Todo Navidad", slug: "todo-navidad" },
  { id: "baby-shower", name: "Todo Baby Shower", slug: "todo-baby-shower" },
  { id: "halloween", name: "Todo Halloween", slug: "todo-halloween" },
  { id: "stitch", name: "Todo Stitch", slug: "todo-stitch" },
  { id: "pokemon", name: "Todo Pokemon", slug: "todo-pokemon" },
  { id: "futbol", name: "Todo Futbol", slug: "todo-futbol" },
];

const groupMatchers = {
  celebrations: ["navidad", "baby-shower", "halloween", "ninos", "papa", "mama", "celebracion", "fiestas-patrias", "bebes"],
  characters: ["toy", "snoopy", "stitch", "pokemon", "bluey", "gabby", "marvel", "pooh", "disney", "bob-esponja", "pawpatrol", "spiderman", "lilo", "netflix"],
};

function displayCategory(name: string) {
  return name.replace(/^Todo\s+/i, "").replace(/Pokemon/i, "Pokémon").replace(/Futbol/i, "Fútbol").replace(/Superheroes/i, "Superhéroes").replace(/ToyStory/i, "Toy Story").replace(/Winie The Pooh/i, "Winnie the Pooh").replace(/FoodHall/i, "Food Hall").replace(/LiLo-Stitch/i, "Lilo & Stitch");
}

function categoryHref(slug: string) {
  return `/?categoria=${encodeURIComponent(slug)}#catalogo`;
}

function groupCategories(categories: Category[]) {
  const celebrations: Category[] = [];
  const characters: Category[] = [];
  const themes: Category[] = [];
  categories.forEach((category) => {
    if (groupMatchers.celebrations.some((term) => category.slug.includes(term))) celebrations.push(category);
    else if (groupMatchers.characters.some((term) => category.slug.includes(term))) characters.push(category);
    else themes.push(category);
  });
  return { celebrations, characters, themes };
}

type PublicProduct = {
  id: string;
  slug: string;
  name: string;
  size: string;
  price: number;
  image_url: string;
  featured: boolean;
  product_categories?: { category_id: string }[];
  pos?: string;
};

const fallbackProducts: PublicProduct[] = [
  { id: "demo-1", slug: "oso-tierno", name: "Oso Tierno", size: "8 cm", price: 3990, image_url: "", featured: true, pos: "58% 84%" },
  { id: "demo-2", slug: "flor-vintage", name: "Flor Vintage", size: "7 cm", price: 3490, image_url: "", featured: false, pos: "72% 10%" },
  { id: "demo-3", slug: "arcoiris", name: "Arcoíris", size: "9 cm", price: 3490, image_url: "", featured: true, pos: "45% 48%" },
  { id: "demo-4", slug: "dino-rex", name: "Dino Rex", size: "10 cm", price: 3990, image_url: "", featured: false, pos: "78% 45%" },
  { id: "demo-5", slug: "corazon-clasico", name: "Corazón Clásico", size: "6 cm", price: 2990, image_url: "", featured: false, pos: "90% 23%" },
  { id: "demo-6", slug: "flor-de-primavera", name: "Flor de Primavera", size: "7 cm", price: 3490, image_url: "", featured: false, pos: "82% 82%" },
];

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function DesktopCategoryMenu({ label, menuKey, categories, openMenu, setOpenMenu, alignRight = false }: { label: string; menuKey: string; categories: Category[]; openMenu: string | null; setOpenMenu: (key: string | null) => void; alignRight?: boolean }) {
  const open = openMenu === menuKey;
  return <div className={`mega-menu ${alignRight ? "align-right" : ""}`}><button className="nav-pill" aria-expanded={open} aria-controls={`mega-${menuKey}`} onClick={() => setOpenMenu(open ? null : menuKey)}>{label}<span aria-hidden="true">⌄</span></button>{open && <div className="mega-panel" id={`mega-${menuKey}`}><div className="mega-title"><small>Explorar</small><strong>{label}</strong></div><div className="mega-links">{categories.map((category) => <a key={category.id} href={categoryHref(category.slug)} onClick={() => setOpenMenu(null)}>{displayCategory(category.name)}<span>→</span></a>)}</div></div>}</div>;
}

export default function Home() {
  const [cart, setCart] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("56975265959");
  const [facebookUrl, setFacebookUrl] = useState("https://www.facebook.com/share/1Emwhrwy9q/?mibextid=wwXIfr");
  const [allProducts, setAllProducts] = useState<PublicProduct[]>([]);
  const [visibleProductCount, setVisibleProductCount] = useState(12);
  const [productSearch, setProductSearch] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productSort, setProductSort] = useState("name-asc");
  const [catalogCategories, setCatalogCategories] = useState<Category[]>(fallbackCategories);
  const [openDesktopMenu, setOpenDesktopMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const catalogEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filteredProducts = useMemo(() => {
    const selectedCategory = catalogCategories.find((category) => category.slug === categoryFilter);
    const search = productSearch.trim().toLocaleLowerCase("es");
    const products = allProducts.filter((product) => {
      const matchesSearch = !search || product.name.toLocaleLowerCase("es").includes(search);
      const matchesCategory = !selectedCategory || product.product_categories?.some((link) => link.category_id === selectedCategory.id);
      return matchesSearch && matchesCategory;
    });
    return products.sort((a, b) => {
      if (productSort === "price-asc") return a.price - b.price;
      if (productSort === "price-desc") return b.price - a.price;
      if (productSort === "name-desc") return b.name.localeCompare(a.name, "es");
      return a.name.localeCompare(b.name, "es");
    });
  }, [allProducts, catalogCategories, categoryFilter, productSearch, productSort]);
  const visibleMenuCategories = catalogCategories.filter((category) => category.name.toLocaleLowerCase("es").includes(menuSearch.trim().toLocaleLowerCase("es")));

  useEffect(() => {
    const initialSync = window.setTimeout(() => setCart(readCartCount()), 0);
    const syncCart = (event: Event) => setCart((event as CustomEvent<number>).detail ?? readCartCount());
    window.addEventListener(CART_UPDATED_EVENT, syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener(CART_UPDATED_EVENT, syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("site_settings").select("key,value").in("key", ["whatsapp_number", "facebook_url"]),
      supabase.from("categories").select("id,name,slug").eq("active", true).order("name"),
      supabase
        .from("products")
        .select("id,slug,name,size,price,image_url,featured,product_categories(category_id)")
        .eq("active", true)
        .order("name"),
    ]).then(([settingsResult, categoriesResult, allProductsResult]) => {
      const settings = Object.fromEntries((settingsResult.data || []).map((setting) => [setting.key, setting.value]));
      if (settings.whatsapp_number) setWhatsappNumber(settings.whatsapp_number);
      if (settings.facebook_url) setFacebookUrl(settings.facebook_url);
      if (categoriesResult.data?.length) setCatalogCategories(categoriesResult.data);
      if (allProductsResult.data) {
        const searchParams = new URLSearchParams(window.location.search);
        const selectedSlug = searchParams.get("ver") === "todos" ? null : searchParams.get("categoria");
        const initialSearch = searchParams.get("buscar") || "";
        setCategoryFilter(selectedSlug || "");
        setProductSearch(initialSearch);
        setAllProducts(allProductsResult.data);
        setVisibleProductCount(searchParams.get("ver") === "todos" ? allProductsResult.data.length : 12);
      }
    });
  }, []);

  useEffect(() => {
    const target = catalogEndRef.current;
    if (!target || visibleProductCount >= filteredProducts.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleProductCount((count) => Math.min(count + 12, filteredProducts.length));
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleProductCount, filteredProducts.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    const closeDesktopMenu = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenDesktopMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenDesktopMenu(null);
    };
    document.addEventListener("pointerdown", closeDesktopMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeDesktopMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const categoryGroups = groupCategories(catalogCategories);
  const closeMobileMenu = () => setMenuOpen(false);
  const closeCart = useCallback(() => setCartOpen(false), []);
  return (
    <main>
      <div className="benefit-bar">
        <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.75h11.5v10H3zM14.5 10h3.25L21 13.25v3.5h-6.5z"/><path d="M7.25 19a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm10.5 0a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"/></svg><b>Envíos a todo Chile</b></span>
        <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 10.5-10.5M12.75 5.75l5.5 5.5M15.5 3l.6 1.9L18 5.5l-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9ZM7 7l.45 1.55L9 9l-1.55.45L7 11l-.45-1.55L5 9l1.55-.45L7 7Z"/></svg><b>Moldes personalizados</b></span>
        <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5.4c0 4.6-3.1 7.7-8 9.6-4.9-1.9-8-5-8-9.6V6l8-3Z"/><path d="m8.5 12 2.25 2.25L15.75 9"/></svg><b>Compra 100% segura</b></span>
      </div>

      <header className="header shell">
        <nav className="desktop-nav" aria-label="Navegación principal" ref={navRef}>
          <a className="nav-pill" href="#inicio">Inicio</a>
          <DesktopCategoryMenu label="Celebraciones" menuKey="celebrations" categories={categoryGroups.celebrations} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} />
          <DesktopCategoryMenu label="Personajes" menuKey="characters" categories={categoryGroups.characters} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} />
          <DesktopCategoryMenu label="Temáticas" menuKey="themes" categories={categoryGroups.themes} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} alignRight />
          <a className="nav-pill" href="#catalogo">Altares</a>
          <a className="nav-pill" href="#catalogo">Herramientas</a>
          <Link className="nav-pill nav-all" href="/?ver=todos#catalogo" onClick={() => { setCategoryFilter(""); setVisibleProductCount(allProducts.length || 12); }}>Ver todo</Link>
          <div className="mega-menu align-right"><button className="nav-pill" type="button" aria-expanded={openDesktopMenu === "more"} aria-controls="mega-more" onClick={() => setOpenDesktopMenu(openDesktopMenu === "more" ? null : "more")}>Más <span aria-hidden="true">⌄</span></button>{openDesktopMenu === "more" && <div className="mega-panel more-panel" id="mega-more"><div className="mega-links"><Link href="/contacto" onClick={() => setOpenDesktopMenu(null)}>Contacto <span>→</span></Link><a href="https://galletisima.cl/terminos-y-condiciones">Términos y Condiciones <span>→</span></a><a href="https://galletisima.cl/politica-de-reembolso">Política de reembolso <span>→</span></a><a href="https://galletisima.cl/politica-de-privacidad">Política de privacidad <span>→</span></a></div></div>}</div>
        </nav>
        <button className="category-trigger" aria-label="Abrir categorías" aria-expanded={menuOpen} aria-controls="mobile-category-drawer" onClick={() => setMenuOpen(true)}>
          <span aria-hidden="true">☰</span>
        </button>
        <a className="brand" href="#inicio" aria-label="Galletísima, inicio">
          <Image src="/galletisima-logo.png" alt="Galletísima" width={360} height={140} priority />
        </a>
        <div className="header-actions">
          <form className="header-search" onSubmit={(event) => { event.preventDefault(); setVisibleProductCount(12); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            <input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Busque productos aquí..." aria-label="Buscar productos" />
            <button type="submit" aria-label="Buscar">⌕</button>
          </form>
          <button className="icon-button cart" aria-label={`Abrir carrito con ${cart} productos`} onClick={() => setCartOpen(true)}>
            🛒<em>{cart}</em>
          </button>
        </div>
        {menuOpen && <div className="drawer-layer"><button className="drawer-backdrop" aria-label="Cerrar categorías" onClick={closeMobileMenu} /><nav id="mobile-category-drawer" className="category-drawer" aria-label="Categorías"><div className="drawer-head"><div><small>Explora la tienda</small><strong>Categorías</strong></div><button aria-label="Cerrar categorías" onClick={closeMobileMenu}>×</button></div><form className="drawer-search" onSubmit={(event) => { event.preventDefault(); setProductSearch(menuSearch); setVisibleProductCount(12); closeMobileMenu(); document.getElementById("catalogo")?.scrollIntoView({behavior:"smooth"}); }}><label htmlFor="home-drawer-search">Buscar productos o categorías</label><div><input id="home-drawer-search" type="search" value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="¿Qué molde buscas?" autoComplete="off"/><button type="submit" aria-label="Buscar productos">⌕</button></div></form><a className="drawer-direct" href="#inicio" onClick={closeMobileMenu}>Inicio <span>→</span></a><p className="drawer-list-title">Clasificación <b>{visibleMenuCategories.length}</b></p><MobileCategoryAccordions categories={visibleMenuCategories} close={closeMobileMenu} />{!visibleMenuCategories.length && <p className="drawer-search-empty">No hay categorías con ese nombre. Presiona buscar para revisar los productos.</p>}<Link className="drawer-direct" href="/contacto" onClick={closeMobileMenu}>Contacto <span>→</span></Link></nav></div>}
      </header>
      <CartDrawer open={cartOpen} onClose={closeCart} />

      <section id="inicio" className="hero">
        <div className="hero-image" role="img" aria-label="Moldes verdes y galletas decoradas sobre fondo rosado" />
        <div className="hero-content shell">
          <p className="eyebrow">MOLDES QUE CONVIERTEN</p>
          <h1>tus ideas en<br/><strong>galletas<br/>increíbles</strong></h1>
          <p className="hero-copy">Diseños únicos para cada ocasión<br/>o crea tu propio molde personalizado.</p>
          <div className="hero-buttons">
            <Link className="button primary" href="/?ver=todos#catalogo" onClick={() => { setCategoryFilter(""); setVisibleProductCount(allProducts.length || 12); }}>VER TODOS LOS MOLDES <span>→</span></Link>
            <a className="button secondary" href="#contacto">MOLDE PERSONALIZADO <span>→</span></a>
          </div>
        </div>
        <div className="hero-note"><span aria-hidden="true">✦</span><small>Hechos para</small><strong>crear momentos</strong><b>únicos</b></div>
      </section>

      <section id="catalogo" className="section catalog-section shell">
        <p className="eyebrow catalog-eyebrow">CATÁLOGO COMPLETO</p>
        <h2>Todos nuestros moldes</h2>
        <div className="title-line" />
        <div className="catalog-filters">
          <label className="catalog-search"><span>Buscar</span><input ref={searchInputRef} id="catalog-search-input" type="search" value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setVisibleProductCount(12); }} placeholder="Nombre del molde…" /></label>
          <label><span>Categoría</span><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setVisibleProductCount(12); }}><option value="">Todas las categorías</option>{catalogCategories.map((category) => <option key={category.id} value={category.slug}>{displayCategory(category.name)}</option>)}</select></label>
          <label><span>Ordenar</span><select value={productSort} onChange={(event) => { setProductSort(event.target.value); setVisibleProductCount(12); }}><option value="name-asc">Nombre A–Z</option><option value="name-desc">Nombre Z–A</option><option value="price-asc">Precio menor a mayor</option><option value="price-desc">Precio mayor a menor</option></select></label>
          <button type="button" onClick={() => setVisibleProductCount(12)}>Buscar</button>
        </div>
        <p className="catalog-count">{filteredProducts.length} {filteredProducts.length === 1 ? "producto" : "productos"}</p>
        <div className="product-grid">
          {filteredProducts.slice(0, visibleProductCount).map((product) => {
            return <article className="product-card" key={product.id}>
              <Link className={`product-photo ${product.image_url ? "has-product-image" : ""}`} href={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`} style={{ backgroundImage: product.image_url ? `url(${product.image_url})` : undefined }}>
                {product.featured && <span className="tag">favorito</span>}
              </Link>
              <div className="product-info">
                <div><h3><Link href={`/producto/${product.slug}`}>{product.name}</Link></h3><strong>{product.price ? currency.format(product.price) : "Consultar"}</strong></div>
                <Link className="product-buy" href={`/producto/${product.slug}`} aria-label={`Comprar ${product.name}`}>Comprar</Link>
              </div>
            </article>;
          })}
        </div>
        <div ref={catalogEndRef} className="catalog-loader" aria-live="polite">
          {visibleProductCount < filteredProducts.length ? <><i /><span>Cargando más moldes…</span></> : filteredProducts.length > 0 ? <span>Has visto los {filteredProducts.length} productos</span> : <span>No encontramos productos con estos filtros.</span>}
        </div>
      </section>

      <section className="values">
        <div className="shell value-grid">
          <div><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.5 17.6 9l5.4 1.6-5.4 1.6-1.6 5.4-1.6-5.4L9 10.6 14.4 9 16 3.5Z"/><path d="m24.5 17 .9 3.1 3.1.9-3.1.9-.9 3.1-.9-3.1-3.1-.9 3.1-.9.9-3.1ZM7.5 18l1.1 3.9 3.9 1.1-3.9 1.1L7.5 28l-1.1-3.9L2.5 23l3.9-1.1L7.5 18Z"/></svg></span><p>Diseños únicos<br/><b>y originales</b></p></div>
          <div><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.5 20 6l4.7.2.2 4.7 2.6 4-2.6 4 .2 4.7-4.7.2-4 2.6-4-2.6-4.7-.2-.2-4.7-2.6-4 2.6-4-.2-4.7L12 6l4-2.5Z"/><path d="m11.5 16 3 3 6-6"/></svg></span><p>Materiales de alta<br/><b>calidad y duraderos</b></p></div>
          <div><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4.5c-2.8 4.1-6.5 8.3-6.5 13a6.5 6.5 0 0 0 13 0c0-4.7-3.7-8.9-6.5-13Z"/><path d="M21.5 5.5 22.6 9l3.4 1-3.4 1-1.1 3.5-1-3.5-3.5-1 3.5-1 1-3.5Z"/><path d="M12.7 18.5a3.5 3.5 0 0 0 3.3 2.8"/></svg></span><p>Fáciles de usar y<br/><b>fáciles de limpiar</b></p></div>
          <div><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27S5 20.6 5 12.7A6.2 6.2 0 0 1 16 8.8a6.2 6.2 0 0 1 11 3.9C27 20.6 16 27 16 27Z"/><path d="M16 11.5v8M12 15.5h8"/></svg></span><p>Hechos para inspirar<br/><b>tus creaciones</b></p></div>
        </div>
      </section>

      <footer id="contacto">
        <div className="shell footer-inner">
          <div className="footer-brand"><Image src="/galletisima-logo.png" alt="Galletísima" width={220} height={86} /><p>Moldes únicos para convertir tus ideas<br/>en galletas inolvidables.</p><div className="social-links"><a className="instagram-link" href="https://www.instagram.com/galletisimacl" target="_blank" rel="noreferrer" aria-label="Síguenos en Instagram como galletisimacl"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle className="instagram-dot" cx="17.4" cy="6.7" r="1"/></svg><span>@galletisimacl</span></a><a className="facebook-link" href={facebookUrl} target="_blank" rel="noreferrer" aria-label="Síguenos en Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 21v-8h2.8l.4-3h-3.2V8.1c0-.9.3-1.5 1.6-1.5H18V3.9c-.7-.1-1.5-.2-2.3-.2-2.3 0-3.9 1.4-3.9 4V10H9v3h2.8v8h2.7Z"/></svg><span>Facebook</span></a></div></div>
          <nav className="footer-links" aria-label="Información legal"><h2>Información</h2><a href="/contacto">Contacto</a><a href="https://galletisima.cl/terminos-y-condiciones">Términos y Condiciones</a><a href="https://galletisima.cl/politica-de-reembolso">Política de reembolso</a><a href="https://galletisima.cl/politica-de-privacidad">Política de privacidad</a></nav>
          <div className="footer-contact"><h2>Encuéntranos</h2><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer"><span>WhatsApp</span><strong>+56 9 7526 5959</strong></a><a href="https://maps.google.com/maps?q=Metro+Vicente+Valdes+La+Florida%2C+La+Florida%2C+Regi%C3%B3n+Metropolitana%2C+Chile" target="_blank" rel="noreferrer"><span>Retiro en La Florida</span><strong>Metro Vicente Valdés</strong></a></div>
        </div>
        <div className="shell footer-legal">
          <p className="footer-copyright">© 2026 Galletísima. Todos los derechos reservados.</p>
          <a href="/contacto">Hecho con cariño en Chile ♡</a>
        </div>
      </footer>
      <a className="whatsapp" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" aria-label="Escríbenos por WhatsApp">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3A12.9 12.9 0 0 0 5 22.57L3.28 29l6.58-1.72A12.98 12.98 0 1 0 16.04 3Zm0 23.76a10.7 10.7 0 0 1-5.45-1.49l-.39-.23-3.9 1.02 1.04-3.8-.25-.4a10.72 10.72 0 1 1 8.95 4.9Zm5.88-8.03c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.71.16-.22.32-.83 1.05-1.02 1.27-.18.21-.37.24-.69.08-1.89-.94-3.12-1.69-4.37-3.82-.33-.57.33-.53.94-1.76.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.22 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.66s1.15 3.08 1.3 3.29c.16.21 2.25 3.43 5.45 4.81.76.33 1.36.53 1.82.67.77.24 1.46.21 2.01.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.29-.22-.61-.38Z"/></svg>
      </a>
    </main>
  );
}
