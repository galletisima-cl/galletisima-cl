"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "../lib/supabase/client";
import type { AppliedDiscount } from "../lib/discounts";
import { orderStatuses, orderStatusLabel, safeTrackingUrl } from "../lib/order-status";

type NotificationSummary = { id: string; status: string; created_at: string; sent_at: string | null; first_attempt_at: string | null };

type AdminOrderItem = {
  id: string; name: string; size: string; quantity: number; line_total: number;
  product: { sku: string; image_url: string } | null;
};

type AdminOrder = {
  id: string; public_order_number: string | null; buy_order: string; buyer_name: string; buyer_email: string;
  buyer_phone: string; status: string; payment_status: string; total: number; shipping_commune: string;
  shipping_address: string; shipping_address_extra: string; created_at: string; updated_at: string;
  shipping_tracking_number?: string; shipping_tracking_url?: string; shipping_carrier?: string;
  order_status_notifications?: NotificationSummary[];
  subtotal?: number; shipping?: number; discount_amount?: number; shipping_discount?: number; applied_discounts?: AppliedDiscount[];
  order_items: AdminOrderItem[];
};

const orderSelect = "*,order_items(id,name,size,quantity,line_total,product:products(sku,image_url)),order_status_notifications(id,status,created_at,sent_at,first_attempt_at)";
const statuses = orderStatuses;
const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const statusLabel = orderStatusLabel;
const orderNumber = (order: AdminOrder) => order.public_order_number || order.buy_order;

function OrderItemThumbnail({ src, name }: { src: string | undefined; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = src?.trim();

  if (!imageSrc || imageSrc === failedSrc) {
    return <span className="order-item-thumbnail order-item-no-image"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/></svg><span>Sin imagen</span></span>;
  }

  return <Image className="order-item-thumbnail" src={imageSrc} alt={`Miniatura de ${name}`} width={64} height={64} unoptimized onError={() => setFailedSrc(imageSrc)} />;
}

function ActionIcon({ name }: { name: "view" | "edit" | "delete" }) {
  if (name === "view") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
  if (name === "edit") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>;
}

export default function AdminOrdersPanel({ notify, fail }: { notify: (message: string) => void; fail: (message: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [detailOrder, setDetailOrder] = useState<AdminOrder | null>(null);
  const [editOrder, setEditOrder] = useState<AdminOrder | null>(null);
  const [editStatus, setEditStatus] = useState("review");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [carrier, setCarrier] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingShippingId, setUpdatingShippingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("orders").select(orderSelect).order("created_at", { ascending: false }).limit(300).overrideTypes<AdminOrder[], { merge: false }>();
    setLoading(false);
    if (error) return fail(error.message);
    setOrders(data || []);
  }

  useEffect(() => {
    let active = true;
    void supabase.from("orders").select(orderSelect).order("created_at", { ascending: false }).limit(300).overrideTypes<AdminOrder[], { merge: false }>().then(({ data, error }) => {
      if (!active) return;
      setLoading(false);
      if (error) return fail(error.message);
      setOrders(data || []);
    });
    return () => { active = false; };
  }, [supabase, fail]);

  function openEdit(order: AdminOrder, status = order.status === "pending" ? "review" : order.status) {
    setEditStatus(status);
    setTrackingNumber(order.shipping_tracking_number || "");
    setTrackingUrl(order.shipping_tracking_url || "");
    setCarrier(order.shipping_carrier || "");
    setEditError("");
    setEditOrder(order);
  }

  async function changeStatus(order: AdminOrder, fields: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Tu sesión expiró. Vuelve a ingresar.");
    const response = await fetch("/api/orders/status", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ orderId: order.id, expectedUpdatedAt: order.updated_at, ...fields }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No pudimos actualizar el pedido.");
    const merge = (current: AdminOrder): AdminOrder => ({
      ...current, ...data.order,
      order_status_notifications: data.notification
        ? [...(current.order_status_notifications || []).filter(event => event.id !== data.notification.id), data.notification]
        : current.order_status_notifications,
    });
    setOrders(current => current.map(candidate => candidate.id === order.id ? merge(candidate) : candidate));
    setDetailOrder(current => current?.id === order.id ? merge(current) : current);
    if (data.warning) { fail(data.warning); return; }
    notify(data.notification?.sent_at
      ? `Pedido #${orderNumber(order)} actualizado. Aviso por correo enviado.`
      : "El pedido no tiene cambios de estado pendientes.");
  }

  async function saveEdit() {
    if (!editOrder) return;
    setSaving(true); setEditError("");
    try {
      await changeStatus(editOrder, { status: editStatus, trackingNumber, trackingUrl, carrier });
      setEditOrder(null);
    } catch (error) { setEditError(error instanceof Error ? error.message : "No pudimos guardar el pedido."); }
    finally { setSaving(false); }
  }

  async function updateShippingStatus(order: AdminOrder, status: string) {
    if (status === "shipped") { openEdit(order, status); return; }
    setUpdatingShippingId(order.id);
    try { await changeStatus(order, { status }); }
    catch (error) { fail(error instanceof Error ? error.message : "No pudimos actualizar el pedido."); }
    finally { setUpdatingShippingId(null); }
  }

  async function retryNotification(order: AdminOrder, notificationId: string) {
    setUpdatingShippingId(order.id);
    try { await changeStatus(order, { notificationId }); }
    catch (error) { fail(error instanceof Error ? error.message : "No pudimos reintentar el aviso."); }
    finally { setUpdatingShippingId(null); }
  }

  async function deleteOrder(order: AdminOrder) {
    if (!window.confirm(`¿Eliminar definitivamente el pedido #${orderNumber(order)}?`)) return;
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) return fail(error.message);
    setOrders((current) => current.filter((candidate) => candidate.id !== order.id));
    notify(`Pedido ${orderNumber(order)} eliminado.`);
  }

  const query = search.trim().toLocaleLowerCase("es-CL");
  const visible = orders.filter((order) => (filter === "all" || order.status === filter || (filter === "review" && order.status === "pending")) && (!query || `${order.public_order_number} ${order.buy_order} ${order.buyer_name} ${order.buyer_email} ${order.shipping_commune}`.toLocaleLowerCase("es-CL").includes(query)));
  const paid = orders.filter((order) => order.payment_status === "authorized");

  return <section className="admin-orders">
    <div className="order-metrics"><article><small>Pedidos</small><strong>{orders.length}</strong><span>registrados</span></article><article><small>Pagados</small><strong>{paid.length}</strong><span>confirmados</span></article><article><small>Por preparar</small><strong>{orders.filter((order) => order.status === "review" || order.status === "pending").length}</strong><span>requieren atención</span></article></div>
    <section className="panel orders-management">
      <div className="panel-title"><div><h2>Pedidos</h2><p>Gestiona las compras y el estado que verá cada cliente.</p></div><button type="button" onClick={() => void load()} disabled={loading}>↻ Actualizar</button></div>
      <div className="order-admin-filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, cliente, correo o comuna…" aria-label="Buscar pedidos" /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar pedidos"><option value="all">Todos los estados</option>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Allow keyboard users to scroll the overflow table. */}
      <div className="admin-orders-table-wrap" role="region" aria-label="Lista de pedidos" tabIndex={0}>
        <table className="admin-orders-table">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Comuna</th><th>Pago</th><th>Envío</th><th>Total</th><th className="actions-heading">Acciones</th></tr></thead>
          <tbody>{visible.map((order) => <tr key={order.id}>
            <td><strong>#{orderNumber(order)}</strong><small>{new Date(order.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</small></td>
            <td><strong>{order.buyer_name}</strong><small>{order.buyer_email}</small>{order.order_status_notifications?.some(event => !event.sent_at) && <button className="order-email-pending" type="button" onClick={() => setDetailOrder(order)}>Correo sin confirmar</button>}</td>
            <td>{order.shipping_commune}</td>
            <td><span className={`payment-status ${order.payment_status === "authorized" ? "paid" : "unpaid"}`}>{order.payment_status === "authorized" ? "Pagado" : "Pendiente"}</span></td>
            <td><select className={`shipping-status-select status-${order.status}`} value={order.status === "pending" ? "review" : order.status} disabled={updatingShippingId === order.id} aria-label={`Estado de envío del pedido ${orderNumber(order)}`} onChange={(event) => void updateShippingStatus(order, event.target.value)}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></td>
            <td><strong>{money.format(order.total)}</strong></td>
            <td><div className="order-actions"><button type="button" title="Ver detalle" aria-label={`Ver detalle del pedido ${orderNumber(order)}`} onClick={() => setDetailOrder(order)}><ActionIcon name="view" /></button><button type="button" title="Editar" aria-label={`Editar pedido ${orderNumber(order)}`} onClick={() => openEdit(order)}><ActionIcon name="edit" /></button><button type="button" className="danger" title="Eliminar" aria-label={`Eliminar pedido ${orderNumber(order)}`} onClick={() => void deleteOrder(order)}><ActionIcon name="delete" /></button></div></td>
          </tr>)}</tbody>
        </table>
        {!loading && !visible.length && <div className="admin-orders-empty">No encontramos pedidos con estos filtros.</div>}
        {loading && <div className="admin-orders-empty">Cargando pedidos…</div>}
      </div>
    </section>

    {detailOrder && <div className="order-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailOrder(null); }}>
      <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
        <header><div><small>PEDIDO</small><h2 id="order-detail-title">#{orderNumber(detailOrder)}</h2></div><button type="button" onClick={() => setDetailOrder(null)} aria-label="Cerrar detalle">×</button></header>
        <div className="order-detail-grid">
          <div><small>CLIENTE</small><strong>{detailOrder.buyer_name}</strong><span>{detailOrder.buyer_email}</span><span>{detailOrder.buyer_phone || "Sin teléfono"}</span></div>
          <div><small>DESPACHO</small><strong>{detailOrder.shipping_commune}</strong><span>{detailOrder.shipping_address}{detailOrder.shipping_address_extra ? `, ${detailOrder.shipping_address_extra}` : ""}</span></div>
          <div><small>ESTADO</small><strong>{statusLabel(detailOrder.status)}</strong><span>{detailOrder.payment_status === "authorized" ? "Pago confirmado" : "Pago pendiente"}</span></div>
          <div><small>FECHA</small><strong>{new Date(detailOrder.created_at).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })}</strong></div>
        </div>
        {detailOrder.shipping_tracking_number && <section className="order-tracking-details">
          <h3>Seguimiento del envío</h3>
          {detailOrder.shipping_carrier && <p>{detailOrder.shipping_carrier}</p>}
          <p>Número: <strong>{detailOrder.shipping_tracking_number}</strong></p>
          {safeTrackingUrl(detailOrder.shipping_tracking_url) && <a href={safeTrackingUrl(detailOrder.shipping_tracking_url)!} target="_blank" rel="noopener noreferrer">Abrir seguimiento ↗</a>}
        </section>}
        {!!detailOrder.order_status_notifications?.length && <section className="order-notifications">
          <h3>Avisos al cliente</h3>
          <p>Correo del cliente: {detailOrder.buyer_email}</p>
          <ul>{[...detailOrder.order_status_notifications].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(event => <li key={event.id}>
            <div><strong>{statusLabel(event.status)}</strong><small>{new Date(event.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</small><span>{event.sent_at ? "Correo enviado" : "Envío sin confirmar"}</span></div>
            {!event.sent_at && <button type="button" disabled={!!updatingShippingId} onClick={() => void retryNotification(detailOrder, event.id)}>{updatingShippingId === detailOrder.id ? "Enviando…" : "Reintentar correo"}</button>}
          </li>)}</ul>
        </section>}
        <div className="order-detail-items">
          <h3>Productos</h3>
          <ul className="order-item-list">
            {detailOrder.order_items.map((item) => <li className="order-detail-item" key={item.id}>
              <OrderItemThumbnail src={item.product?.image_url} name={item.name} />
              <div className="order-item-info">
                <strong>{item.name}</strong>
                <span>Cantidad: {item.quantity}{item.size ? ` · ${item.size}` : ""}</span>
                <span className="order-item-sku">SKU: <strong>{item.product?.sku?.trim() || "No disponible"}</strong></span>
              </div>
              <strong className="order-item-total">{money.format(item.line_total)}</strong>
            </li>)}
          </ul>
          <div className="order-pricing">
            <div><span>Subtotal de productos</span><strong>{money.format(detailOrder.subtotal ?? detailOrder.order_items.reduce((sum, item) => sum + item.line_total, 0))}</strong></div>
            {(detailOrder.discount_amount || 0) > 0 && <div className="checkout-discount"><span>Descuentos</span><strong>−{money.format(detailOrder.discount_amount || 0)}</strong></div>}
            <div><span>Envío</span><strong>{detailOrder.shipping ? money.format(detailOrder.shipping) : "Gratis"}</strong></div>
            {(detailOrder.shipping_discount || 0) > 0 && <small className="checkout-discount">Ahorro en envío: {money.format(detailOrder.shipping_discount || 0)}</small>}
            {!!detailOrder.applied_discounts?.length && <small>Promociones aplicadas: {detailOrder.applied_discounts.map((discount) => discount.name).join(", ")}.</small>}
          </div>
          <div className="order-detail-total"><span>Total</span><strong>{money.format(detailOrder.total)}</strong></div>
        </div>
      </section>
    </div>}

    {editOrder && <div className="order-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditOrder(null); }}>
      <section className="order-modal order-edit-modal" role="dialog" aria-modal="true" aria-labelledby="order-edit-title">
        <header><div><small>EDITAR PEDIDO</small><h2 id="order-edit-title">#{orderNumber(editOrder)}</h2></div><button type="button" onClick={() => setEditOrder(null)} disabled={saving} aria-label="Cerrar edición">×</button></header>
        <form onSubmit={event => { event.preventDefault(); void saveEdit(); }}>
          <label>Estado del envío<select value={editStatus} disabled={saving} onChange={event => setEditStatus(event.target.value)}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          {editStatus === "shipped" && <fieldset disabled={saving}>
            <legend>Datos del despacho</legend>
            <label>Empresa de envío <small>(opcional)</small><input name="carrier" value={carrier} onChange={event => setCarrier(event.target.value)} maxLength={100} placeholder="Ej. Blue Express" /></label>
            <label>Número de seguimiento<input name="trackingNumber" required value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} maxLength={100} placeholder="Ej. 123456789" /></label>
            <label>Enlace de seguimiento<input name="trackingUrl" required type="url" value={trackingUrl} onChange={event => setTrackingUrl(event.target.value)} maxLength={2048} placeholder="https://…" /></label>
          </fieldset>}
          <p className="order-email-note">Al guardar un cambio se enviará un correo a <strong>{editOrder.buyer_email || "correo no registrado"}</strong>{editStatus === "shipped" ? " con el estado, el número y el enlace de seguimiento." : " con el nuevo estado del pedido."}</p>
          {editError && <p className="order-edit-error" role="alert">{editError}</p>}
          <footer><button type="button" onClick={() => setEditOrder(null)} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : editStatus === "shipped" ? "Guardar y avisar" : "Guardar cambios"}</button></footer>
        </form>
      </section>
    </div>}
  </section>;
}
