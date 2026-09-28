"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CartItem } from "../lib/cart";

export default function WebpayButton({ items, expanded = false, isIntegration = false, onNavigate }: { items: CartItem[]; expanded?: boolean; isIntegration?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm] = useState(expanded);
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "", communeId: "", address: "", addressExtra: "" });
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [regionId, setRegionId] = useState("");
  const productSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedShipping = shippingOptions.find((option) => option.communeId === buyer.communeId);
  const regions = useMemo(() => [...new Map(shippingOptions.map((option) => [option.regionId, option.region])).entries()], [shippingOptions]);
  const communeOptions = shippingOptions.filter((option) => option.regionId === regionId && option.active);

  useEffect(() => {
    if (!showForm || shippingOptions.length) return;
    fetch("/api/shipping/options").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos cargar las comunas.");
      setShippingOptions(data.options || []);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "No pudimos cargar las comunas."));
  }, [showForm, shippingOptions.length]);

  async function pay() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/webpay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer, items: items.map(({ productId, size, quantity }) => ({ productId, size, quantity })) }),
      });
      const data = await response.json();
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

  if (!showForm) return <button className="webpay-button" type="button" onClick={() => { onNavigate?.(); router.push("/checkout"); }}><PaymentShield /><span className="webpay-button-copy"><strong>Pagar con Webpay</strong><small>Débito, crédito y prepago</small></span><span className="webpay-button-arrow" aria-hidden="true">→</span></button>;

  return <form className="webpay-form" onSubmit={(event) => { event.preventDefault(); void pay(); }}>
    <label>Nombre<input required minLength={2} autoComplete="name" value={buyer.name} onChange={(event) => setBuyer({ ...buyer, name: event.target.value })} /></label>
    <label>Correo<input required type="email" autoComplete="email" placeholder="tu@correo.cl" value={buyer.email} onChange={(event) => setBuyer({ ...buyer, email: event.target.value })} /></label>
    <label>Teléfono <small>(opcional)</small><input type="tel" autoComplete="tel" value={buyer.phone} onChange={(event) => setBuyer({ ...buyer, phone: event.target.value })} /></label>
    <div className="webpay-form-grid">
      <label>Región<select required value={regionId} onChange={(event) => { setRegionId(event.target.value); setBuyer({ ...buyer, communeId: "" }); }}><option value="">Selecciona región</option>{regions.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
      <label>Comuna<select required disabled={!regionId} value={buyer.communeId} onChange={(event) => setBuyer({ ...buyer, communeId: event.target.value })}><option value="">Selecciona comuna</option>{communeOptions.map((option) => <option value={option.communeId} key={option.communeId}>{option.commune}</option>)}</select></label>
    </div>
    <label>Dirección<input required minLength={5} autoComplete="street-address" placeholder="Calle, número" value={buyer.address} onChange={(event) => setBuyer({ ...buyer, address: event.target.value })} /></label>
    <label>Depto., casa o referencia <small>(opcional)</small><input autoComplete="address-line2" value={buyer.addressExtra} onChange={(event) => setBuyer({ ...buyer, addressExtra: event.target.value })} /></label>
    {selectedShipping && <div className="webpay-total"><span>Productos <strong>{currency(productSubtotal)}</strong></span><span>Envío a {selectedShipping.commune} <strong>{currency(selectedShipping.price)}</strong></span><b>Total <strong>{currency(productSubtotal + selectedShipping.price)}</strong></b></div>}
    <button className="webpay-button" type="submit" disabled={loading}>
      <PaymentShield />
      <span className="webpay-button-copy"><strong>{loading ? "Conectando con Webpay…" : "Continuar a Webpay"}</strong><small>Pago procesado de forma segura</small></span>
      {!loading && <span className="webpay-button-arrow" aria-hidden="true">→</span>}
    </button>
    <small className="webpay-test-note">{isIntegration ? "Modo de prueba: no se realizará un cobro real." : "Serás dirigido a Webpay para completar el pago de forma segura."}</small>
    {error && <p className="webpay-error" role="alert">{error}</p>}
  </form>;
}

function PaymentShield() {
  return <span className="webpay-button-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.8-2.8 8.1-7 10-4.2-1.9-7-5.2-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg></span>;
}

type ShippingOption = { communeId: string; commune: string; regionId: string; region: string; price: number; active: boolean };
const currency = (value: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
