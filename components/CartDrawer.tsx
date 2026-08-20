"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CART_UPDATED_EVENT, CartItem, clearCart, readCartItems, removeCartItem, updateCartQuantity } from "../lib/cart";
import { createClient } from "../lib/supabase/client";
import { createWhatsappUrl } from "../lib/whatsapp";

const currency = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [whatsapp, setWhatsapp] = useState("56975265959");
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  useEffect(() => {
    const sync = () => setItems(readCartItems());
    const timer = window.setTimeout(sync, 0);
    window.addEventListener(CART_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    createClient().from("site_settings").select("value").eq("key", "whatsapp_number").maybeSingle().then(({ data }) => { if (data?.value) setWhatsapp(data.value); });
    return () => { window.clearTimeout(timer); window.removeEventListener(CART_UPDATED_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const openSync = window.setTimeout(() => setItems(readCartItems()), 0);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", escape);
    return () => { window.clearTimeout(openSync); document.body.style.overflow = previous; window.removeEventListener("keydown", escape); };
  }, [open, onClose]);

  if (!open) return null;
  const message = ["Hola Galletísima, quiero realizar este pedido:", "", ...items.map((item) => `• ${item.quantity} × ${item.name}${item.size ? ` (${item.size})` : ""} — ${currency.format(item.price * item.quantity)}`), "", `Total: ${currency.format(total)}`].join("\n");

  return <div className="cart-layer"><button className="cart-backdrop" aria-label="Cerrar carrito" onClick={onClose} /><aside className="cart-drawer" aria-label="Carrito de compra" aria-modal="true" role="dialog"><div className="cart-head"><div><small>Tu compra</small><strong>Carrito</strong></div><button type="button" aria-label="Cerrar carrito" onClick={onClose}>×</button></div>{items.length ? <><div className="cart-items">{items.map((item) => <article className="cart-item" key={`${item.productId}-${item.size}`}><Link className="cart-item-image" href={`/producto/${item.slug}`} onClick={onClose} style={{ backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined }} /><div><Link href={`/producto/${item.slug}`} onClick={onClose}>{item.name}</Link>{item.size && <small>Medida: {item.size}</small>}<strong>{currency.format(item.price * item.quantity)}</strong><div className="cart-quantity"><button type="button" aria-label={`Disminuir ${item.name}`} onClick={() => updateCartQuantity(item.productId, item.size, item.quantity - 1)}>−</button><span>{item.quantity}</span><button type="button" aria-label={`Aumentar ${item.name}`} onClick={() => updateCartQuantity(item.productId, item.size, item.quantity + 1)}>+</button><button className="cart-remove" type="button" onClick={() => removeCartItem(item.productId, item.size)}>Eliminar</button></div></div></article>)}</div><div className="cart-summary"><p><span>Total</span><strong>{currency.format(total)}</strong></p><a href={createWhatsappUrl(whatsapp, message)} target="_blank" rel="noreferrer">Finalizar por WhatsApp</a><button type="button" onClick={() => clearCart()}>Vaciar carrito</button></div></> : <div className="cart-empty"><span>♡</span><h2>Tu carrito está vacío</h2><p>Explora nuestros moldes y elige tu medida favorita.</p><Link href="/?ver=todos#catalogo" onClick={onClose}>Ver todos los productos</Link></div>}</aside></div>;
}
