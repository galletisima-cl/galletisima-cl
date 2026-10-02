"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CART_UPDATED_EVENT, CartItem, readCartItems } from "../lib/cart";
import WebpayButton from "./WebpayButton";

const currency = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function CheckoutPage({ isIntegration }: { isIntegration: boolean }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  useEffect(() => {
    const sync = () => { setItems(readCartItems()); setReady(true); };
    sync();
    window.addEventListener(CART_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(CART_UPDATED_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  return <main className="checkout-page">
    <header className="checkout-header"><Link href="/" aria-label="Volver a Galletísima"><Image src="/galletisima-logo.png" alt="Galletísima" width={230} height={90} priority /></Link><div><span>Compra protegida</span><small>Pago seguro mediante Webpay</small></div></header>
    {!ready ? <div className="checkout-loading">Preparando tu compra…</div> : !items.length ? <section className="checkout-empty"><span>♡</span><h1>Tu carrito está vacío</h1><p>Agrega tus moldes favoritos antes de continuar al pago.</p><Link href="/?ver=todos#catalogo">Volver a la tienda</Link></section> : <div className="checkout-layout">
      <section className="checkout-form-card"><div className="checkout-step"><span>1</span><div><small>DATOS DE COMPRA</small><h1>Completa tu información</h1><p>Usaremos estos datos para coordinar y entregar tu pedido.</p></div></div><WebpayButton items={items} expanded isIntegration={isIntegration} /></section>
      <aside className="checkout-summary-card"><div className="checkout-summary-title"><div><small>TU PEDIDO</small><h2>Resumen</h2></div><Link href="/">Seguir comprando</Link></div><div className="checkout-products">{items.map((item) => <article key={`${item.productId}-${item.size}`}><span className="checkout-product-image" style={{ backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined }}><b>{item.quantity}</b></span><div><strong>{item.name}</strong>{item.size && <small>Medida: {item.size}</small>}</div><b>{currency.format(item.price * item.quantity)}</b></article>)}</div><div className="checkout-subtotal"><span>Subtotal</span><strong>{currency.format(subtotal)}</strong><small>Los descuentos y el despacho se calcularán al seleccionar la comuna.</small></div><div className="checkout-security"><span>✓</span><p><strong>Pago 100% seguro</strong><small>Tus datos se envían cifrados a Webpay.</small></p></div></aside>
    </div>}
  </main>;
}
