import { NextResponse } from "next/server";
import { getMetaEventSourceUrl, sendMetaConversionEvent } from "../../../../lib/meta-conversions";
import type { MetaBrowserEventName, MetaCartEventData } from "../../../../lib/meta-pixel";

export const runtime = "nodejs";

const eventNames = new Set<MetaBrowserEventName>(["ViewCart", "AddToCart", "InitiateCheckout"]);
const allowedPaths = ["/", "/checkout", "/contacto", "/terminos-y-condiciones", "/politica-de-reembolso", "/politica-de-privacidad"];

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 20_000) {
    return NextResponse.json({ error: "El evento Meta excede el tamaño permitido." }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo del evento Meta no es JSON válido." }, { status: 400 });
  }

  if (typeof body.event_name !== "string" || !eventNames.has(body.event_name as MetaBrowserEventName)
    || typeof body.event_id !== "string" || !/^[\w.-]{1,100}$/.test(body.event_id)
    || !isMetaCartEventData(body.custom_data)) {
    return NextResponse.json({ error: "Los datos del evento Meta no son válidos." }, { status: 400 });
  }

  let source: URL;
  let eventSourceUrl: string;
  try {
    source = new URL(String(body.event_source_url));
    eventSourceUrl = getMetaEventSourceUrl(request.headers, source.pathname);
  } catch {
    return NextResponse.json({ error: "El evento no proviene del sitio de producción." }, { status: 403 });
  }
  if (source.origin !== new URL(eventSourceUrl).origin || !isTrackablePath(source.pathname)) {
    return NextResponse.json({ error: "La URL del evento Meta no está permitida." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin !== source.origin) {
    return NextResponse.json({ error: "El origen de la solicitud no coincide con el sitio." }, { status: 403 });
  }

  try {
    await sendMetaConversionEvent({
      eventName: body.event_name as MetaBrowserEventName,
      eventId: body.event_id,
      eventSourceUrl,
      customData: body.custom_data,
      headers: request.headers,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("No se pudo enviar el evento a Meta Conversions API", error);
    return NextResponse.json({ error: "Meta Conversions API no pudo procesar el evento." }, { status: 502 });
  }
}

function isTrackablePath(pathname: string) {
  return allowedPaths.includes(pathname) || pathname.startsWith("/producto/");
}

function isMetaCartEventData(value: unknown): value is MetaCartEventData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<MetaCartEventData>;
  return data.content_type === "product"
    && data.currency === "CLP"
    && Number.isSafeInteger(data.num_items) && Number(data.num_items) > 0
    && typeof data.value === "number" && Number.isFinite(data.value) && data.value >= 0
    && Array.isArray(data.content_ids) && data.content_ids.length > 0 && data.content_ids.length <= 50
    && data.content_ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 100)
    && Array.isArray(data.contents) && data.contents.length > 0 && data.contents.length <= 50
    && data.contents.every((item) => item && typeof item.id === "string" && item.id.length > 0 && item.id.length <= 100
      && Number.isSafeInteger(item.quantity) && item.quantity > 0
      && typeof item.item_price === "number" && Number.isFinite(item.item_price) && item.item_price >= 0);
}
