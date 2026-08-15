"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CartDrawer from "./CartDrawer";
import MobileCategoryAccordions from "./MobileCategoryAccordions";
import { CART_UPDATED_EVENT, readCartCount } from "../lib/cart";
import { createClient } from "../lib/supabase/client";

type Category = { id: string; name: string; slug: string };

export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const visibleCategories = categories.filter((category) => category.name.toLocaleLowerCase("es").includes(menuSearch.trim().toLocaleLowerCase("es")));

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

  return <header className="public-header shell">
    <button className="public-menu-button" type="button" aria-label="Abrir menú de categorías" aria-expanded={open} aria-controls="public-category-drawer" onClick={() => setOpen(true)}><span aria-hidden="true">☰</span></button>
    <Link className="public-header-logo" href="/" aria-label="Galletísima, inicio"><Image src="/galletisima-logo.png" alt="Galletísima" width={260} height={102} priority /></Link>
    <form className="header-search public-header-search" action="/" method="get"><input name="buscar" type="search" placeholder="Busque productos aquí..." aria-label="Buscar productos" /><button type="submit" aria-label="Buscar">⌕</button></form>
    <button className="public-cart-button" type="button" aria-label={`Abrir carrito con ${cartCount} productos`} onClick={() => setCartOpen(true)}><span aria-hidden="true">🛒</span><em>{cartCount}</em></button>
    {open && <div className="drawer-layer public-drawer-layer"><button className="drawer-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} /><nav id="public-category-drawer" className="category-drawer" aria-label="Categorías"><div className="drawer-head"><div><small>Explora la tienda</small><strong>Categorías</strong></div><button aria-label="Cerrar menú" onClick={() => setOpen(false)}>×</button></div><form className="drawer-search" action="/" method="get"><label htmlFor="public-drawer-search">Buscar productos o categorías</label><div><input id="public-drawer-search" name="buscar" type="search" value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="¿Qué molde buscas?" autoComplete="off"/><button type="submit" aria-label="Buscar productos">⌕</button></div></form><Link className="drawer-direct" href="/" onClick={() => setOpen(false)}>Inicio <span>→</span></Link><p className="drawer-list-title">Clasificación <b>{visibleCategories.length}</b></p><MobileCategoryAccordions categories={visibleCategories} close={() => setOpen(false)} />{!visibleCategories.length && <p className="drawer-search-empty">No hay categorías con ese nombre. Presiona buscar para revisar los productos.</p>}<Link className="drawer-direct" href="/contacto" onClick={() => setOpen(false)}>Contacto <span>→</span></Link></nav></div>}
    <CartDrawer open={cartOpen} onClose={closeCart} />
  </header>;
}
