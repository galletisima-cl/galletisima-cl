"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CartDrawer from "./CartDrawer";
import { CART_UPDATED_EVENT, readCartCount } from "../lib/cart";
import { createClient } from "../lib/supabase/client";

type Category = { id: string; name: string; slug: string };

export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);

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
    <button className="public-cart-button" type="button" aria-label={`Abrir carrito con ${cartCount} productos`} onClick={() => setCartOpen(true)}><span aria-hidden="true">🛒</span><em>{cartCount}</em></button>
    {open && <div className="drawer-layer public-drawer-layer"><button className="drawer-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} /><nav id="public-category-drawer" className="category-drawer" aria-label="Categorías"><div className="drawer-head"><div><small>Explora la tienda</small><strong>Categorías</strong></div><button aria-label="Cerrar menú" onClick={() => setOpen(false)}>×</button></div><Link className="drawer-direct" href="/" onClick={() => setOpen(false)}>Inicio <span>→</span></Link><Link className="drawer-direct drawer-all" href="/?ver=todos#catalogo" onClick={() => setOpen(false)}>Ver todos los productos <span>→</span></Link><p className="drawer-list-title">Todas las categorías <b>{categories.length}</b></p><div className="public-category-links">{categories.map((category) => <Link key={category.id} href={`/?categoria=${encodeURIComponent(category.slug)}#catalogo`} onClick={() => setOpen(false)}>{category.name.replace(/^Todo\s+/i, "")}<span>→</span></Link>)}</div><Link className="drawer-direct" href="/contacto" onClick={() => setOpen(false)}>Contacto <span>→</span></Link></nav></div>}
    <CartDrawer open={cartOpen} onClose={closeCart} />
  </header>;
}
