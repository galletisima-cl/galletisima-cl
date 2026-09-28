"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type AdminOrder = {
  id: string; public_order_number: string | null; buy_order: string; buyer_name: string; buyer_email: string;
  buyer_phone: string; status: string; payment_status: string; total: number; shipping_commune: string;
  shipping_address: string; shipping_address_extra: string; created_at: string;
  order_items: { id: string; name: string; size: string; quantity: number; line_total: number }[];
};

const statuses = [
  ["review", "Pendiente"], ["preparing", "Preparando"], ["shipped", "Enviado"],
  ["delivered", "Entregado"], ["cancelled", "Cancelado"],
];
const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const statusLabel = (status: string) => status === "pending" ? "Pendiente" : statuses.find(([value]) => value === status)?.[1] || "Pendiente";
const orderNumber = (order: AdminOrder) => order.public_order_number || order.buy_order;

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
  const [saving, setSaving] = useState(false);
  const [updatingShippingId, setUpdatingShippingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("orders").select("*,order_items(id,name,size,quantity,line_total)").order("created_at", { ascending: false }).limit(300);
    setLoading(false);
    if (error) return fail(error.message);
    setOrders((data || []) as AdminOrder[]);
  }

  useEffect(() => {
    let active = true;
    void supabase.from("orders").select("*,order_items(id,name,size,quantity,line_total)").order("created_at", { ascending: false }).limit(300).then(({ data, error }) => {
      if (!active) return;
      setLoading(false);
      if (error) return fail(error.message);
      setOrders((data || []) as AdminOrder[]);
    });
    return () => { active = false; };
  }, [supabase, fail]);

  function openEdit(order: AdminOrder) {
    setEditStatus(order.status === "pending" ? "review" : order.status);
    setEditOrder(order);
  }

  async function saveEdit() {
    if (!editOrder) return;
    setSaving(true);
    const { error } = await supabase.from("orders").update({ status: editStatus }).eq("id", editOrder.id);
    setSaving(false);
    if (error) return fail(error.message);
    setOrders((current) => current.map((order) => order.id === editOrder.id ? { ...order, status: editStatus } : order));
    notify(`Pedido ${orderNumber(editOrder)} actualizado.`);
    setEditOrder(null);
  }

  async function updateShippingStatus(order: AdminOrder, status: string) {
    setUpdatingShippingId(order.id);
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    setUpdatingShippingId(null);
    if (error) return fail(error.message);
    setOrders((current) => current.map((candidate) => candidate.id === order.id ? { ...candidate, status } : candidate));
    notify(`Envío del pedido ${orderNumber(order)} actualizado a ${statusLabel(status)}.`);
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
      <div className="admin-orders-table-wrap">
        <table className="admin-orders-table">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Comuna</th><th>Pago</th><th>Envío</th><th>Total</th><th className="actions-heading">Acciones</th></tr></thead>
          <tbody>{visible.map((order) => <tr key={order.id}>
            <td><strong>#{orderNumber(order)}</strong><small>{new Date(order.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</small></td>
            <td><strong>{order.buyer_name}</strong><small>{order.buyer_email}</small></td>
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

    {detailOrder && <div className="order-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailOrder(null); }}><section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="order-detail-title"><header><div><small>PEDIDO</small><h2 id="order-detail-title">#{orderNumber(detailOrder)}</h2></div><button type="button" onClick={() => setDetailOrder(null)} aria-label="Cerrar detalle">×</button></header><div className="order-detail-grid"><div><small>CLIENTE</small><strong>{detailOrder.buyer_name}</strong><span>{detailOrder.buyer_email}</span><span>{detailOrder.buyer_phone || "Sin teléfono"}</span></div><div><small>DESPACHO</small><strong>{detailOrder.shipping_commune}</strong><span>{detailOrder.shipping_address}{detailOrder.shipping_address_extra ? `, ${detailOrder.shipping_address_extra}` : ""}</span></div><div><small>ESTADO</small><strong>{statusLabel(detailOrder.status)}</strong><span>{detailOrder.payment_status === "authorized" ? "Pago confirmado" : "Pago pendiente"}</span></div><div><small>FECHA</small><strong>{new Date(detailOrder.created_at).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })}</strong></div></div><div className="order-detail-items"><h3>Productos</h3>{detailOrder.order_items.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}{item.size ? ` · ${item.size}` : ""}</span><strong>{money.format(item.line_total)}</strong></div>)}<div className="order-detail-total"><span>Total</span><strong>{money.format(detailOrder.total)}</strong></div></div></section></div>}

    {editOrder && <div className="order-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditOrder(null); }}><section className="order-modal order-edit-modal" role="dialog" aria-modal="true" aria-labelledby="order-edit-title"><header><div><small>EDITAR PEDIDO</small><h2 id="order-edit-title">#{orderNumber(editOrder)}</h2></div><button type="button" onClick={() => setEditOrder(null)} disabled={saving} aria-label="Cerrar edición">×</button></header><label>Estado del envío<select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><footer><button type="button" onClick={() => setEditOrder(null)} disabled={saving}>Cancelar</button><button type="button" className="primary" onClick={() => void saveEdit()} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></footer></section></div>}
  </section>;
}
