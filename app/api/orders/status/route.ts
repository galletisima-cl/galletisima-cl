import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { orderStatuses, safeTrackingUrl, type StatusNotification } from "../../../../lib/order-status";
import { sendStatusEmail, statusEmailPayload } from "../../../../lib/order-status-email";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const summary = (event: StatusNotification) => ({ id: event.id, status: event.status, created_at: event.created_at, sent_at: event.sent_at, first_attempt_at: event.first_attempt_at });

async function deliver(supabase: SupabaseClient, event: StatusNotification) {
  if (event.sent_at) return { notification: summary(event) };
  try {
    if (!process.env.RESEND_API_KEY) throw new Error("Resend no está configurado.");
    // Persist the exact payload before calling Resend so retries reuse both key and body.
    if (!event.email_payload) {
      const { data, error } = await supabase.from("order_status_notifications")
        .update({ email_payload: statusEmailPayload(event), first_attempt_at: new Date().toISOString() })
        .eq("id", event.id).is("email_payload", null).select("*").maybeSingle();
      if (error) throw new Error("No se pudo registrar el intento de correo.");
      if (data) event = data as StatusNotification;
      else {
        const result = await supabase.from("order_status_notifications").select("*").eq("id", event.id).single();
        if (result.error) throw new Error("No se pudo consultar el intento de correo.");
        event = result.data as StatusNotification;
      }
    }
    if (event.sent_at) return { notification: summary(event) };
    // Resend deduplicates for 24h. Stop uncertain retries before that window expires.
    if (!event.first_attempt_at || Date.now() - Date.parse(event.first_attempt_at) >= 23 * 60 * 60 * 1000) {
      return { notification: summary(event), warning: "El aviso sigue sin confirmar. Revisa su estado en Resend antes de reenviarlo: venció el plazo seguro de reintento." };
    }
    const providerId = await sendStatusEmail(event.id, event.email_payload!);
    const sentAt = new Date().toISOString();
    const { error } = await supabase.from("order_status_notifications").update({ sent_at: sentAt, provider_id: providerId }).eq("id", event.id);
    if (error) throw new Error("No se pudo registrar la confirmación del correo.");
    return { notification: summary({ ...event, sent_at: sentAt }) };
  } catch {
    return { notification: summary(event), warning: "El pedido está guardado, pero el envío del correo no está confirmado. Puedes reintentarlo desde el detalle del pedido." };
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: "Inicia sesión para actualizar pedidos." }, { status: 401 });
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("Missing server configuration");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a ingresar." }, { status: 401 });
    if (auth.user.app_metadata.role !== "admin") return NextResponse.json({ error: "No tienes permisos para actualizar pedidos." }, { status: 403 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.orderId !== "string" || !uuid.test(body.orderId)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    let result: { order?: Record<string, unknown>; event_id?: string | null; changed?: boolean } = {};
    if (body.notificationId !== undefined) {
      if (typeof body.notificationId !== "string" || !uuid.test(body.notificationId)) return NextResponse.json({ error: "Aviso inválido." }, { status: 400 });
      result.event_id = body.notificationId;
    } else {
      if (!orderStatuses.some(([status]) => status === body.status) || typeof body.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
        return NextResponse.json({ error: "Revisa el estado y actualiza la lista de pedidos." }, { status: 400 });
      }
      const trackingNumber = typeof body.trackingNumber === "string" ? body.trackingNumber.trim() : "";
      const carrier = typeof body.carrier === "string" ? body.carrier.trim() : "";
      const trackingUrl = safeTrackingUrl(typeof body.trackingUrl === "string" ? body.trackingUrl.trim() : "");
      if (body.status === "shipped" && (!trackingNumber || trackingNumber.length > 100 || [...trackingNumber + carrier].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || carrier.length > 100 || !trackingUrl)) {
        return NextResponse.json({ error: "Para enviar el pedido, ingresa un número de seguimiento y un enlace válido (https://…)." }, { status: 400 });
      }
      const { data, error } = await supabase.rpc("change_order_status", {
        p_order_id: body.orderId, p_status: body.status, p_expected_updated_at: body.expectedUpdatedAt,
        p_tracking_number: body.status === "shipped" ? trackingNumber : "",
        p_tracking_url: body.status === "shipped" ? trackingUrl : "",
        p_carrier: body.status === "shipped" ? carrier : "",
      });
      if (error?.code === "40001") return NextResponse.json({ error: "El pedido cambió en otra sesión. Actualiza la lista antes de guardar." }, { status: 409 });
      if (error?.code === "P0002") return NextResponse.json({ error: "No encontramos ese pedido." }, { status: 404 });
      if (error) throw new Error("Status transaction failed");
      result = data;
    }
    if (!result.event_id) return NextResponse.json({ ...result, notification: null });
    const { data: event, error } = await supabase.from("order_status_notifications").select("*").eq("id", result.event_id).eq("order_id", body.orderId).maybeSingle();
    if (error) {
      if (result.order) return NextResponse.json({ ...result, warning: "El pedido está guardado. Actualiza la lista para consultar y reintentar su aviso pendiente." });
      throw new Error("Notification read failed");
    }
    if (!event) return NextResponse.json({ error: "No encontramos ese aviso para el pedido." }, { status: 404 });
    return NextResponse.json({ ...result, ...await deliver(supabase, event as StatusNotification) });
  } catch {
    return NextResponse.json({ error: "No pudimos completar la solicitud. Actualiza la lista para comprobar el estado del pedido antes de reintentar." }, { status: 500 });
  }
}
