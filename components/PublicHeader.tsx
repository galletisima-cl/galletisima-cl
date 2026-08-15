"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CartDrawer from "./CartDrawer";
import MobileCategoryAccordions from "./MobileCategoryAccordions";
import { CART_UPDATED_EVENT, readCartCount } from "../lib/cart";
import { createClient } from "../lib/supabase/client";

type Category = { id: string; name: string; slug: string };

const celebrationTerms = ["navidad", "baby-shower", "halloween", "ninos", "papa", "mama", "celebracion", "fiestas-patrias", "bebes"];
const characterTerms = ["toy", "snoopy", "stitch", "pokemon", "bluey", "gabby", "marvel", "pooh", "disney", "bob-esponja", "pawpatrol", "spiderman", "lilo", "netflix"];

function displayCategory(name: string) {
  return name.replace(/^Todo\s+/i, "");
}

function categoryHref(slug: string) {
  return `/?categoria=${encodeURIComponent(slug)}#catalogo`;
}

function DesktopCategoryMenu({ label, menuKey, categories, openMenu, setOpenMenu, alignRight = false }: { label: string; menuKey: string; categories: Category[]; openMenu: string | null; setOpenMenu: (key: string | null) => void; alignRight?: boolean }) {
  const expanded = openMenu === menuKey;
  return <div className={`mega-menu ${alignRight ? "align-right" : ""}`}><button className="nav-pill" type="button" aria-expanded={expanded} aria-controls={`public-mega-${menuKey}`} onClick={() => setOpenMenu(expanded ? null : menuKey)}>{label}<span aria-hidden="true">⌄</span></button>{expanded && <div className="mega-panel" id={`public-mega-${menuKey}`}><div className="mega-title"><small>Explorar</small><strong>{label}</strong></div><div className="mega-links">{categories.map((category) => <Link key={category.id} href={categoryHref(category.slug)} onClick={() => setOpenMenu(null)}>{displayCategory(category.name)}<span>→</span></Link>)}</div></div>}</div>;
}

export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [openDesktopMenu, setOpenDesktopMenu] = useState<string | null>(null);
  const visibleCategories = categories.filter((category) => category.name.toLocaleLowerCase("es").includes(menuSearch.trim().toLocaleLowerCase("es")));
  const categoryGroups = {
    celebrations: categories.filter((category) => celebrationTerms.some((term) => category.slug.includes(term))),
    characters: categories.filter((category) => characterTerms.some((term) => category.slug.includes(term))),
    themes: categories.filter((category) => !celebrationTerms.some((term) => category.slug.includes(term)) && !characterTerms.some((term) => category.slug.includes(term))),
  };

  useEffect(() => {
    const initialSync = window.setTimeout(() => setCartCount(readCartCount()), 0);
    const syncCart = (event: Event) => setCartCount((event as CustomEvent<number>).detail ?? readCartCount());
    window.addEventListener(CART_UPDATED_EVENT, syncCart);
    window.addEventListener("storage", syncCart);
    createClient().from("categories").select("id,name,slug").eq("active", true).order("name")
      .then(({ data }) => setCategories(data || []));
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener(CART_UPDATED_EVENT, syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const closeCart = useCallback(() => setCartOpen(false), []);

  return <>
    <div className="benefit-bar public-benefit-bar">
      <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.75h11.5v10H3zM14.5 10h3.25L21 13.25v3.5h-6.5z"/><path d="M7.25 19a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm10.5 0a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"/></svg><b>Envíos a todo Chile</b></span>
      <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 10.5-10.5M12.75 5.75l5.5 5.5M15.5 3l.6 1.9L18 5.5l-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9ZM7 7l.45 1.55L9 9l-1.55.45L7 11l-.45-1.55L5 9l1.55-.45L7 7Z"/></svg><b>Moldes personalizados</b></span>
      <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5.4c0 4.6-3.1 7.7-8 9.6-4.9-1.9-8-5-8-9.6V6l8-3Z"/><path d="m8.5 12 2.25 2.25L15.75 9"/></svg><b>Compra 100% segura</b></span>
    </div>
    <header className="public-header shell">
      <button className="public-menu-button" type="button" aria-label="Abrir menú de categorías" aria-expanded={open} aria-controls="public-category-drawer" onClick={() => setOpen(true)}><span aria-hidden="true">☰</span></button>
      <Link className="public-header-logo" href="/" aria-label="Galletísima, inicio"><Image src="/galletisima-logo.png" alt="Galletísima" width={260} height={102} priority /></Link>
      <form className="header-search public-header-search" action="/" method="get"><input name="buscar" type="search" placeholder="Busque productos aquí..." aria-label="Buscar productos" /><button type="submit" aria-label="Buscar">⌕</button></form>
      <button className="public-cart-button" type="button" aria-label={`Abrir carrito con ${cartCount} productos`} onClick={() => setCartOpen(true)}><span aria-hidden="true">🛒</span><em>{cartCount}</em></button>
      <nav className="desktop-nav public-desktop-nav" aria-label="Navegación principal">
        <Link className="nav-pill" href="/">Inicio</Link>
        <DesktopCategoryMenu label="Celebraciones" menuKey="celebrations" categories={categoryGroups.celebrations} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} />
        <DesktopCategoryMenu label="Personajes" menuKey="characters" categories={categoryGroups.characters} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} />
        <DesktopCategoryMenu label="Temáticas" menuKey="themes" categories={categoryGroups.themes} openMenu={openDesktopMenu} setOpenMenu={setOpenDesktopMenu} alignRight />
        <Link className="nav-pill" href="/?buscar=altares#catalogo">Altares</Link>
        <Link className="nav-pill" href="/?buscar=herramientas#catalogo">Herramientas</Link>
        <Link className="nav-pill nav-all" href="/?ver=todos#catalogo">Ver todo</Link>
        <div className="mega-menu align-right"><button className="nav-pill" type="button" aria-expanded={openDesktopMenu === "more"} aria-controls="public-mega-more" onClick={() => setOpenDesktopMenu(openDesktopMenu === "more" ? null : "more")}>Más <span aria-hidden="true">⌄</span></button>{openDesktopMenu === "more" && <div className="mega-panel more-panel" id="public-mega-more"><div className="mega-links"><Link href="/contacto" onClick={() => setOpenDesktopMenu(null)}>Contacto <span>→</span></Link><a href="https://galletisima.cl/terminos-y-condiciones">Términos y Condiciones <span>→</span></a><a href="https://galletisima.cl/politica-de-reembolso">Política de reembolso <span>→</span></a><a href="https://galletisima.cl/politica-de-privacidad">Política de privacidad <span>→</span></a></div></div>}</div>
      </nav>
      {open && <div className="drawer-layer public-drawer-layer"><button className="drawer-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} /><nav id="public-category-drawer" className="category-drawer" aria-label="Categorías"><div className="drawer-head"><div><small>Explora la tienda</small></div><button aria-label="Cerrar menú" onClick={() => setOpen(false)}>×</button></div><form className="drawer-search" action="/" method="get"><label htmlFor="public-drawer-search">Buscar productos o categorías</label><div><input id="public-drawer-search" name="buscar" type="search" value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="¿Qué molde buscas?" autoComplete="off" /><button type="submit" aria-label="Buscar productos">⌕</button></div></form><Link className="drawer-direct" href="/" onClick={() => setOpen(false)}>Inicio <span>→</span></Link><p className="drawer-list-title">Clasificación <b>{visibleCategories.length}</b></p><MobileCategoryAccordions categories={visibleCategories} close={() => setOpen(false)} />{!visibleCategories.length && <p className="drawer-search-empty">No hay categorías con ese nombre. Presiona buscar para revisar los productos.</p>}<Link className="drawer-direct" href="/contacto" onClick={() => setOpen(false)}>Contacto <span>→</span></Link></nav></div>}
      <CartDrawer open={cartOpen} onClose={closeCart} />
    </header>
  </>;
}
