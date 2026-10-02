import { createClient } from "@supabase/supabase-js";
import type { CheckoutLine } from "./checkout";
import type { AppliedDiscount } from "./discounts";

export type Buyer = { name: string; email: string; phone: string; communeId: string; address: string; addressExtra: string };

export type StoredOrder = {
  id: string;
  buy_order: string;
  public_order_number: string;
  total: number;
  discount_amount?: number;
  shipping_discount?: number;
  applied_discounts?: AppliedDiscount[];
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  shipping: number;
  shipping_region: string;
  shipping_commune: string;
  shipping_address: string;
  shipping_address_extra: string;
  payment_status: string;
  authorization_code: string | null;
  payment_type_code: string | null;
  card_last_four: string | null;
  installments_number: number | null;
  transaction_date: string | null;
  email_sent_at: string | null;
};

function adminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado para registrar pedidos.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createPendingOrder(input: {
  buyOrder: string;
  sessionId: string;
  token: string;
  total: number;
  subtotal: number;
  shipping: number;
  shippingOption: { regionId: string; region: string; communeId: string; commune: string };
  buyer: Buyer;
  lines: CheckoutLine[];
  discountAmount: number;
  shippingDiscount: number;
  appliedDiscounts: AppliedDiscount[];
}) {
  const supabase = adminSupabase();
  const { data: order, error } = await supabase.from("orders").insert({
    status: "pending",
    subtotal: input.subtotal,
    shipping: input.shipping,
    total: input.total,
    ...(input.appliedDiscounts.length ? {
      discount_amount: input.discountAmount,
      shipping_discount: input.shippingDiscount,
      applied_discounts: input.appliedDiscounts,
    } : {}),
    buyer_name: input.buyer.name,
    buyer_email: input.buyer.email,
    buyer_phone: input.buyer.phone,
    shipping_region_id: input.shippingOption.regionId,
    shipping_region: input.shippingOption.region,
    shipping_commune_id: input.shippingOption.communeId,
    shipping_commune: input.shippingOption.commune,
    shipping_address: input.buyer.address,
    shipping_address_extra: input.buyer.addressExtra,
    payment_status: "pending",
    payment_provider: "webpay",
    buy_order: input.buyOrder,
    public_order_number: input.buyOrder,
    session_id: input.sessionId,
    webpay_token: input.token,
  }).select("id").single();
  if (error || !order) throw new Error("No pudimos registrar el pedido antes del pago.");

  const { error: itemsError } = await supabase.from("order_items").insert(input.lines.map((line) => ({
    order_id: order.id,
    product_id: line.productId,
    name: line.name,
    size: line.size,
    quantity: line.quantity,
    unit_price: line.unitPrice,
  })));
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw new Error("No pudimos registrar los productos del pedido.");
  }
  return order.id as string;
}

export async function getNextOrderNumber() {
  const { data, error } = await adminSupabase().rpc("next_order_number");
  if (error || typeof data !== "string" || !/^\d{11,}$/.test(data)) throw new Error("No pudimos generar el número de pedido.");
  return data;
}

export async function findOrderByToken(token: string) {
  const { data, error } = await adminSupabase().from("orders").select("*").eq("webpay_token", token).maybeSingle();
  if (error) throw new Error("No pudimos consultar el pedido.");
  return data as StoredOrder | null;
}

export async function getOrderLines(orderId: string) {
  const { data, error } = await adminSupabase().from("order_items").select("name,size,quantity,unit_price,line_total").eq("order_id", orderId);
  if (error) throw new Error("No pudimos consultar el detalle del pedido.");
  return data || [];
}

export async function updateOrderPayment(orderId: string, result: Record<string, unknown>, paymentStatus: StoredOrder["payment_status"]) {
  const card = result.card_detail as { card_number?: string } | undefined;
  const { data, error } = await adminSupabase().from("orders").update({
    payment_status: paymentStatus,
    status: paymentStatus === "authorized" ? "review" : "pending",
    authorization_code: result.authorization_code ? String(result.authorization_code) : null,
    payment_type_code: result.payment_type_code ? String(result.payment_type_code) : null,
    card_last_four: card?.card_number ? String(card.card_number) : null,
    installments_number: Number(result.installments_number || 0) || null,
    accounting_date: result.accounting_date ? String(result.accounting_date) : null,
    transaction_date: result.transaction_date ? String(result.transaction_date) : null,
    payment_response: result,
    paid_at: paymentStatus === "authorized" ? new Date().toISOString() : null,
  }).eq("id", orderId).select("*").single();
  if (error || !data) throw new Error("No pudimos actualizar el estado del pedido.");
  return data as StoredOrder;
}

export async function markOrderCancelled(buyOrder: string | null) {
  if (!buyOrder) return;
  await adminSupabase().from("orders").update({ payment_status: "cancelled" }).eq("buy_order", buyOrder).eq("payment_status", "pending");
}

export async function markOrderEmailSent(orderId: string) {
  await adminSupabase().from("orders").update({ email_sent_at: new Date().toISOString() }).eq("id", orderId).is("email_sent_at", null);
}
