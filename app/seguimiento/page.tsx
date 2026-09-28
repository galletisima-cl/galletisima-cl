"use client";

import { FormEvent, useState } from "react";
import PublicHeader from "../../components/PublicHeader";

type TrackedOrder = { public_order_number: string; status: string; payment_status: string; total: number; shipping_commune: string; created_at: string; paid_at: string | null };

const steps = [
  { key: "review", label: "Pedido recibido", copy: "Tu pago fue confirmado y revisaremos los productos." },
  { key: "preparing", label: "En preparación", copy: "Estamos preparando tu pedido con mucho cuidado." },
  { key: "shipped", label: "En camino", copy: "El pedido fue entregado al servicio de despacho." },
  { key: "delivered", label: "Entregado", copy: "El pedido llegó a su destino." },
];
const statusPosition: Record<string, number> = { pending: 0, review: 0, preparing: 1, shipped: 2, delivered: 3 };
const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function TrackingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  async function track(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setOrder(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/orders/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber: form.get("orderNumber"), email: form.get("email") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos consultar el pedido.");
      setOrder(data.order);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos consultar el pedido.");
    } finally { setLoading(false); }
  }

  const currentStep = order ? statusPosition[order.status] ?? 0 : 0;
  return <main className="tracking-page">
    <PublicHeader />
    <section className="tracking-shell shell">
      <header><span className="tracking-icon" aria-hidden="true">⌖</span><p className="eyebrow">SIGUE TU COMPRA</p><h1>¿Dónde está mi pedido?</h1><p>Ingresa el número que recibiste en tu comprobante y el correo usado en la compra.</p></header>
      <form className="tracking-form" onSubmit={track}>
        <label>Número de pedido<input name="orderNumber" required inputMode="numeric" pattern="[0-9]{11,}" maxLength={14} placeholder="20260924001" /></label>
        <label>Correo de compra<input name="email" required type="email" autoComplete="email" placeholder="tu@correo.cl" /></label>
        <button disabled={loading}>{loading ? "Consultando…" : "Consultar pedido"}</button>
      </form>
      {error && <p className="tracking-error" role="alert">{error}</p>}
      {order && <section className="tracking-result" aria-live="polite">
        <div className="tracking-order-head"><div><small>PEDIDO</small><strong>#{order.public_order_number}</strong></div><div><small>DESTINO</small><strong>{order.shipping_commune}</strong></div><div><small>TOTAL</small><strong>{money.format(order.total)}</strong></div></div>
        {order.status === "cancelled" || order.payment_status !== "authorized" ? <div className="tracking-cancelled"><strong>Pedido no completado</strong><p>El pago fue cancelado o todavía no ha sido confirmado.</p></div> : <ol className="tracking-timeline">{steps.map((step, index) => <li className={index <= currentStep ? "complete" : ""} key={step.key}><span>{index < currentStep ? "✓" : index + 1}</span><div><strong>{step.label}</strong><p>{step.copy}</p></div></li>)}</ol>}
        <p className="tracking-help">¿Necesitas ayuda? Escríbenos indicando tu número de pedido.</p>
      </section>}
    </section>
  </main>;
}

