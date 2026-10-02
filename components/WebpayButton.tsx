"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CartItem } from "../lib/cart";
import type { CheckoutQuote } from "./useCheckoutQuote";

export default function WebpayButton({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  return <button className="webpay-button" type="button" onClick={() => { onNavigate?.(); router.push("/checkout"); }}><PaymentShield /><span className="webpay-button-copy"><strong>Pagar con Webpay</strong><small>Débito, crédito y prepago</small></span><span className="webpay-button-arrow" aria-hidden="true">→</span></button>;
}

export function CheckoutForm({ items, checkout, isIntegration = false }: { items: CartItem[]; checkout: CheckoutQuote; isIntegration?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "", address: "", addressExtra: "" });
  const { communeId, regionId, regions, communeOptions, selectedShipping, pricing, quoteError, shippingError, isQuoting } = checkout;

  async function pay() {
    if (!pricing || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/webpay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer: { ...buyer, communeId }, expectedTotal: pricing.total, items: items.map(({ productId, size, quantity }) => ({ productId, size, quantity })) }),
      });
      const data = await response.json();
      if (response.status === 409 && data.pricing) checkout.updatePricing(data.pricing);
      if (!response.ok || !data.url || !data.token) throw new Error(data.error || "No pudimos iniciar el pago.");

      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.url;
      const token = document.createElement("input");
      token.type = "hidden";
      token.name = "token_ws";
      token.value = data.token;
      form.appendChild(token);
      document.body.appendChild(form);
      form.submit();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos iniciar el pago.");
      setLoading(false);
    }
  }

  return <form className="webpay-form" onSubmit={(event) => { event.preventDefault(); void pay(); }}>
    <label>Nombre<input required minLength={2} autoComplete="name" value={buyer.name} onChange={(event) => setBuyer({ ...buyer, name: event.target.value })} /></label>
    <label>Correo<input required type="email" autoComplete="email" placeholder="tu@correo.cl" value={buyer.email} onChange={(event) => setBuyer({ ...buyer, email: event.target.value })} /></label>
    <label>Teléfono <small>(opcional)</small><input type="tel" autoComplete="tel" value={buyer.phone} onChange={(event) => setBuyer({ ...buyer, phone: event.target.value })} /></label>
    <div className="webpay-form-grid">
      <label>Región<select required value={regionId} onChange={(event) => { setError(""); checkout.selectRegion(event.target.value); }}><option value="">Selecciona región</option>{regions.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
      <label>Comuna<select required disabled={!regionId} value={communeId} onChange={(event) => { setError(""); checkout.selectCommune(event.target.value); }}><option value="">Selecciona comuna</option>{communeOptions.map((option) => <option value={option.communeId} key={option.communeId}>{option.commune}</option>)}</select></label>
    </div>
    {selectedShipping && <div className="checkout-shipping-preview" role="status" aria-live="polite" aria-busy={isQuoting}>
      <span>Envío a {selectedShipping.commune}</span>
      <strong>{pricing ? pricing.shipping === 0 ? "Gratis" : currency(pricing.shipping) : quoteError ? "No disponible" : "Calculando…"}</strong>
    </div>}
    <label>Dirección<input required minLength={5} autoComplete="street-address" placeholder="Calle, número" value={buyer.address} onChange={(event) => setBuyer({ ...buyer, address: event.target.value })} /></label>
    <label>Depto., casa o referencia <small>(opcional)</small><input autoComplete="address-line2" value={buyer.addressExtra} onChange={(event) => setBuyer({ ...buyer, addressExtra: event.target.value })} /></label>
    {selectedShipping && <div className="webpay-total" aria-live="polite" aria-busy={isQuoting}>
      {pricing ? <>
        <span>Productos <strong>{currency(pricing.subtotal)}</strong></span>
        {pricing.appliedDiscounts.filter((discount) => discount.kind !== "free_shipping").map((discount) => <span className="checkout-discount" key={discount.id}><span>{discount.name}</span><strong>−{currency(discount.amount)}</strong></span>)}
        <span>Envío a {selectedShipping.commune} <strong>{pricing.shipping === 0 ? "Gratis" : currency(pricing.shipping)}</strong></span>
        {pricing.shippingDiscount > 0 && <small className="checkout-discount">Envío gratis aplicado: ahorras {currency(pricing.shippingDiscount)}.</small>}
        <b>Total <strong>{currency(pricing.total)}</strong></b>
      </> : <span>{quoteError ? "No pudimos calcular el total." : "Calculando descuentos y envío…"}</span>}
    </div>}
    {quoteError && <button type="button" className="checkout-quote-retry" onClick={() => { setError(""); checkout.retry(); }}>Volver a calcular</button>}
    <button className="webpay-button" type="submit" disabled={loading || !pricing}>
      <PaymentShield />
      <span className="webpay-button-copy"><strong>{loading ? "Conectando con Webpay…" : "Continuar a Webpay"}</strong><small>Pago procesado de forma segura</small></span>
      {!loading && <span className="webpay-button-arrow" aria-hidden="true">→</span>}
    </button>
    <small className="webpay-test-note">{isIntegration ? "Modo de prueba: no se realizará un cobro real." : "Serás dirigido a Webpay para completar el pago de forma segura."}</small>
    {(quoteError || shippingError || error) && <p className="webpay-error" role="alert">{quoteError || shippingError || error}</p>}
  </form>;
}

function PaymentShield() {
  return <span className="webpay-button-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.8-2.8 8.1-7 10-4.2-1.9-7-5.2-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg></span>;
}

const currency = (value: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
