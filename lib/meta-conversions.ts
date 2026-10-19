import { createHash } from "node:crypto";
import { META_PIXEL_ID, type MetaCartEventData } from "./meta-pixel";

type MetaEventName = "ViewCart" | "AddToCart" | "InitiateCheckout" | "Purchase";
type MetaHeaders = Pick<Headers, "get">;

const allowedHostnames = new Set(["galletisima.cl", "www.galletisima.cl"]);

export function getMetaEventSourceUrl(headers: MetaHeaders, pathname: string) {
  const hostname = (headers.get("x-forwarded-host") || headers.get("host") || "").split(",")[0].trim().split(":")[0].toLowerCase();
  if (!allowedHostnames.has(hostname)) throw new Error("Meta Conversions API solo está habilitada para el dominio de producción.");
  return `https://${hostname}${pathname}`;
}

export async function sendMetaConversionEvent(input: {
  eventName: MetaEventName;
  eventId: string;
  eventSourceUrl: string;
  customData: MetaCartEventData & { order_id?: string };
  headers: MetaHeaders;
  email?: string;
  phone?: string;
}) {
  const accessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Falta configurar META_CONVERSIONS_ACCESS_TOKEN.");

  const graphVersion = process.env.META_GRAPH_API_VERSION || "v25.0";
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error("META_GRAPH_API_VERSION tiene un formato inválido.");

  const source = new URL(input.eventSourceUrl);
  if (source.protocol !== "https:" || !allowedHostnames.has(source.hostname)) {
    throw new Error("La URL de origen del evento Meta no corresponde al sitio de producción.");
  }

  const userData = getMetaUserData(input.headers);
  if (input.email) userData.em = [sha256(input.email.trim().toLowerCase())];
  if (input.phone) {
    const normalizedPhone = input.phone.replace(/\D/g, "");
    if (normalizedPhone) userData.ph = [sha256(normalizedPhone)];
  }

  const event = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: "website",
    event_source_url: `${source.origin}${source.pathname}`,
    user_data: userData,
    custom_data: input.customData,
  };
  const payload: { data: typeof event[]; test_event_code?: string } = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  const endpoint = new URL(`https://graph.facebook.com/${graphVersion}/${META_PIXEL_ID}/events`);
  endpoint.searchParams.set("access_token", accessToken);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Meta Conversions API respondió ${response.status}: ${responseText.slice(0, 500)}`);
  }
  let result: { events_received?: unknown };
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error("Meta Conversions API respondió con un formato no válido.");
  }
  if (result.events_received !== 1) {
    throw new Error(`Meta Conversions API no confirmó el evento: ${responseText.slice(0, 500)}`);
  }
}

function getMetaUserData(headers: MetaHeaders) {
  const userData: Record<string, string | string[]> = {};
  const ipAddress = headers.get("cf-connecting-ip") || headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0].trim();
  const userAgent = headers.get("user-agent");
  if (ipAddress) userData.client_ip_address = ipAddress;
  if (userAgent) userData.client_user_agent = userAgent;

  const cookies = headers.get("cookie") || "";
  const fbp = readCookie(cookies, "_fbp");
  const fbc = readCookie(cookies, "_fbc");
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  return userData;
}

function readCookie(cookieHeader: string, name: string) {
  const value = cookieHeader.split(";").map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${name}=`))?.slice(name.length + 1);
  return value && value.length <= 500 ? value : undefined;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
