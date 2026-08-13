"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";

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
  return `/?categoria=${encodeURIComponent(slug)}#moldes`;
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
  name: string;
  size: string;
  price: number;
  image_url: string;
  featured: boolean;
  product_categories?: { category_id: string }[];
  pos?: string;
};

const fallbackProducts: PublicProduct[] = [
  { id: "demo-1", name: "Oso Tierno", size: "8 cm", price: 3990, image_url: "", featured: true, pos: "58% 84%" },
  { id: "demo-2", name: "Flor Vintage", size: "7 cm", price: 3490, image_url: "", featured: false, pos: "72% 10%" },
  { id: "demo-3", name: "Arcoíris", size: "9 cm", price: 3490, image_url: "", featured: true, pos: "45% 48%" },
  { id: "demo-4", name: "Dino Rex", size: "10 cm", price: 3990, image_url: "", featured: false, pos: "78% 45%" },
  { id: "demo-5", name: "Corazón Clásico", size: "6 cm", price: 2990, image_url: "", featured: false, pos: "90% 23%" },
  { id: "demo-6", name: "Flor de Primavera", size: "7 cm", price: 3490, image_url: "", featured: false, pos: "82% 82%" },
];

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function getSizes(value: string) {
  return value.split(/[,;\n]+/).map((size) => size.trim()).filter(Boolean);
}

function DesktopCategoryMenu({ label, menuKey, categories, openMenu, setOpenMenu, alignRight = false }: { label: string; menuKey: string; categories: Category[]; openMenu: string | null; setOpenMenu: (key: string | null) => void; alignRight?: boolean }) {
  const open = openMenu === menuKey;
  return <div className={`mega-menu ${alignRight ? "align-right" : ""}`}><button className="nav-pill" aria-expanded={open} aria-controls={`mega-${menuKey}`} onClick={() => setOpenMenu(open ? null : menuKey)}>{label}<span aria-hidden="true">⌄</span></button>{open && <div className="mega-panel" id={`mega-${menuKey}`}><div className="mega-title"><small>Explorar</small><strong>{label}</strong></div><div className="mega-links">{categories.map((category) => <a key={category.id} href={categoryHref(category.slug)} onClick={() => setOpenMenu(null)}>{displayCategory(category.name)}<span>→</span></a>)}</div></div>}</div>;
}

function MobileCategoryGroup({ label, groupKey, categories, openGroup, setOpenGroup, close }: { label: string; groupKey: string; categories: Category[]; openGroup: string | null; setOpenGroup: (key: string | null) => void; close: () => void }) {
  const open = openGroup === groupKey;
  return <section className={`drawer-group ${open ? "open" : ""}`}><button aria-expanded={open} aria-controls={`drawer-${groupKey}`} onClick={() => setOpenGroup(open ? null : groupKey)}><span>{label}</span><i aria-hidden="true">⌄</i></button><div id={`drawer-${groupKey}`} hidden={!open}>{categories.map((category) => <a key={category.id} href={categoryHref(category.slug)} onClick={close}>{displayCategory(category.name)}</a>)}</div></section>;
}

export default function Home() {
  const [cart, setCart] = useState(2);
  const [liked, setLiked] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("56975265959");
  const [catalogProducts, setCatalogProducts] = useState<PublicProduct[]>(fallbackProducts);
  const [catalogCategories, setCatalogCategories] = useState<Category[]>(fallbackCategories);
  const [openDesktopMenu, setOpenDesktopMenu] = useState<string | null>(null);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>("celebrations");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("site_settings").select("value").eq("key", "whatsapp_number").single(),
      supabase.from("categories").select("id,name,slug").eq("active", true).order("name"),
      supabase
        .from("products")
        .select("id,name,size,price,image_url,featured,product_categories(category_id)")
        .eq("active", true)
        .order("featured", { ascending: false })
        .order("name"),
    ]).then(([settingsResult, categoriesResult, productsResult]) => {
      if (settingsResult.data?.value) setWhatsappNumber(settingsResult.data.value);
      if (categoriesResult.data?.length) setCatalogCategories(categoriesResult.data);
      if (productsResult.data?.length) {
        const selectedSlug = new URLSearchParams(window.location.search).get("categoria");
        const selectedCategory = categoriesResult.data?.find((category) => category.slug === selectedSlug);
        const visibleProducts = selectedCategory
          ? productsResult.data.filter((product) => product.product_categories?.some((link) => link.category_id === selectedCategory.id))
          : productsResult.data;
        setCatalogProducts(visibleProducts.slice(0, selectedCategory ? 60 : 12));
      }
    });
  }, []);

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

  const add = (name: string) => {
    setCart((value) => value + 1);
    setNotice(`${name} fue agregado a tu carrito`);
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <main>
      <div className="benefit-bar">
        <span>▣ <b>Envíos a todo Chile</b></span>
        <span>♡ <b>Moldes personalizados</b></span>
        <span>♙ <b>Compra 100% segura</b></span>
      </div>

      <header className="header shell">
        <nav className="desktop-nav" aria-label="Navegación principal" ref={navRef}>
          <a className="nav-pill" href="#inicio">Inicio</a>
          <DesktopCategoryMenu label="Celebraciones" menuKey="celebrations" categories={categoryGroups.celebrations} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} />
          <DesktopCategoryMenu label="Personajes" menuKey="characters" categories={categoryGroups.characters} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} />
          <DesktopCategoryMenu label="Temáticas" menuKey="themes" categories={categoryGroups.themes} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} alignRight />
          <a className="nav-pill" href="#moldes">Altares</a>
          <a className="nav-pill" href="#moldes">Herramientas</a>
          <a className="nav-pill nav-all" href="#categorias">Ver todo</a>
        </nav>
        <button className="category-trigger" aria-label="Abrir categorías" aria-expanded={menuOpen} aria-controls="mobile-category-drawer" onClick={() => setMenuOpen(true)}>
          <span aria-hidden="true">☰</span> Categorías
        </button>
        <a className="brand" href="#inicio" aria-label="Galletísima, inicio">
          <Image src="/galletisima-logo.png" alt="Galletísima" width={360} height={140} priority />
        </a>
        <div className="header-actions">
          <button className="icon-button search" aria-label="Buscar">⌕</button>
          <button className="icon-button cart" aria-label={`Carrito con ${cart} productos`}>
            🛒<em>{cart}</em>
          </button>
        </div>
        {menuOpen && <div className="drawer-layer"><button className="drawer-backdrop" aria-label="Cerrar categorías" onClick={closeMobileMenu} /><nav id="mobile-category-drawer" className="category-drawer" aria-label="Categorías"><div className="drawer-head"><div><small>Explora la tienda</small><strong>Categorías</strong></div><button aria-label="Cerrar categorías" onClick={closeMobileMenu}>×</button></div><a className="drawer-direct" href="#inicio" onClick={closeMobileMenu}>Inicio</a><MobileCategoryGroup label="Celebraciones" groupKey="celebrations" categories={categoryGroups.celebrations} openGroup={openMobileGroup} setOpenGroup={setOpenMobileGroup} close={closeMobileMenu} /><MobileCategoryGroup label="Personajes" groupKey="characters" categories={categoryGroups.characters} openGroup={openMobileGroup} setOpenGroup={setOpenMobileGroup} close={closeMobileMenu} /><MobileCategoryGroup label="Temáticas" groupKey="themes" categories={categoryGroups.themes} openGroup={openMobileGroup} setOpenGroup={setOpenMobileGroup} close={closeMobileMenu} /><a className="drawer-direct" href="#moldes" onClick={closeMobileMenu}>Altares <span>→</span></a><a className="drawer-direct" href="#moldes" onClick={closeMobileMenu}>Herramientas <span>→</span></a><a className="drawer-direct drawer-all" href="#categorias" onClick={closeMobileMenu}>Ver todo <span>→</span></a></nav></div>}
      </header>

      <section id="inicio" className="hero">
        <div className="hero-image" role="img" aria-label="Moldes verdes y galletas decoradas sobre fondo rosado" />
        <div className="hero-content shell">
          <p className="eyebrow">MOLDES QUE CONVIERTEN</p>
          <h1>tus ideas en<br/><strong>galletas<br/>increíbles</strong></h1>
          <p className="hero-copy">Diseños únicos para cada ocasión<br/>o crea tu propio molde personalizado.</p>
          <div className="hero-buttons">
            <a className="button primary" href="#moldes">VER TODOS LOS MOLDES <span>→</span></a>
            <a className="button secondary" href="#contacto">MOLDE PERSONALIZADO <span>→</span></a>
          </div>
        </div>
        <div className="hero-note"><span>♡</span> Hechos para<br/>crear momentos<br/><b>únicos</b></div>
      </section>

      <section id="categorias" className="section shell">
        <h2>Encuentra el molde perfecto</h2>
        <div className="title-line" />
        <div className="categories">
          {catalogCategories.map((category) => <a key={category.id} href={categoryHref(category.slug)}><span>♡</span><small>{displayCategory(category.name)}</small></a>)}
        </div>
      </section>

      <section id="moldes" className="section products-section shell">
        <h2>Los más vendidos</h2>
        <div className="title-line" />
        <div className="product-grid">
          {catalogProducts.map((product) => {
            const isLiked = liked.includes(product.name);
            const sizes = getSizes(product.size);
            return <article className="product-card" key={product.id}>
              <div className="product-photo" style={{ backgroundImage: product.image_url ? `url(${product.image_url})` : undefined, backgroundPosition: product.image_url ? "center" : product.pos }}>
                {product.featured && <span className="tag">favorito</span>}
                <button className={`heart ${isLiked ? "active" : ""}`} aria-label={`Guardar ${product.name}`} onClick={() => setLiked(isLiked ? liked.filter((name) => name !== product.name) : [...liked, product.name])}>♡</button>
              </div>
              <div className="product-info">
                <div><h3>{product.name}</h3>{sizes.length ? <div className="product-sizes" aria-label={`Medidas disponibles: ${sizes.join(", ")}`}>{sizes.map((size) => <span key={size}>{size}</span>)}</div> : <p>Medida por confirmar</p>}<strong>{product.price ? currency.format(product.price) : "Consultar"}</strong></div>
                <button className="add" aria-label={`Agregar ${product.name} al carrito`} onClick={() => add(product.name)}>🛒</button>
              </div>
            </article>;
          })}
        </div>
        <a className="view-all" href="#moldes">VER TODOS LOS MOLDES →</a>
      </section>

      <section className="values">
        <div className="shell value-grid">
          <div><span>❧</span><p>Diseños únicos<br/><b>y originales</b></p></div>
          <div><span>♢</span><p>Materiales de alta<br/><b>calidad y duraderos</b></p></div>
          <div><span>♧</span><p>Fáciles de usar y<br/><b>fáciles de limpiar</b></p></div>
          <div><span>♡</span><p>Hechos para inspirar<br/><b>tus creaciones</b></p></div>
        </div>
      </section>

      <footer id="contacto">
        <div className="shell footer-inner">
          <div className="footer-brand"><Image src="/galletisima-logo.png" alt="Galletísima" width={220} height={86} /><p>Moldes únicos para convertir tus ideas<br/>en galletas inolvidables.</p><a className="instagram-link" href="https://www.instagram.com/galletisimacl" target="_blank" rel="noreferrer" aria-label="Síguenos en Instagram como galletisimacl"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle className="instagram-dot" cx="17.4" cy="6.7" r="1"/></svg><span>@galletisimacl</span></a></div>
          <nav className="footer-links" aria-label="Contacto e información legal"><h2>Información</h2><a href="/contacto">Contacto</a><a href="https://galletisima.cl/terminos-y-condiciones">Términos y Condiciones</a><a href="https://galletisima.cl/politica-de-reembolso">Política de reembolso</a><a href="https://galletisima.cl/politica-de-privacidad">Política de privacidad</a></nav>
          <form className="footer-newsletter" onSubmit={(event) => { event.preventDefault(); setNotice("¡Gracias! Pronto recibirás nuestras novedades"); }}>
            <div><span>Novedades</span><label htmlFor="email">Recibe nuevos diseños y descuentos exclusivos.</label></div>
            <div className="newsletter-field"><input id="email" type="email" placeholder="Tu correo electrónico" required/><button aria-label="Suscribirme">→</button></div>
            <small>Sin spam. Puedes cancelar cuando quieras.</small>
          </form>
        </div>
        <div className="shell footer-legal">
          <p className="footer-copyright">© 2026 Galletísima. Todos los derechos reservados.</p>
          <a href="/contacto">Hecho con cariño en Chile ♡</a>
        </div>
      </footer>
      <a className="whatsapp" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" aria-label="Escríbenos por WhatsApp">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3A12.9 12.9 0 0 0 5 22.57L3.28 29l6.58-1.72A12.98 12.98 0 1 0 16.04 3Zm0 23.76a10.7 10.7 0 0 1-5.45-1.49l-.39-.23-3.9 1.02 1.04-3.8-.25-.4a10.72 10.72 0 1 1 8.95 4.9Zm5.88-8.03c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.71.16-.22.32-.83 1.05-1.02 1.27-.18.21-.37.24-.69.08-1.89-.94-3.12-1.69-4.37-3.82-.33-.57.33-.53.94-1.76.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.22 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.66s1.15 3.08 1.3 3.29c.16.21 2.25 3.43 5.45 4.81.76.33 1.36.53 1.82.67.77.24 1.46.21 2.01.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.29-.22-.61-.38Z"/></svg>
      </a>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
