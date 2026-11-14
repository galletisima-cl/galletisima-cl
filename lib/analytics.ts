// Google Analytics 4 (galletisima.cl). Solo reporta desde el sitio real y de la URL
// solo envía los parámetros de campaña (utm_*, gclid, fbclid): /pago/resultado y
// /seguimiento pueden llevar tokens privados de pedidos.
export const GA_MEASUREMENT_ID = "G-PPDVQD2S3W";

type GtagArgs = unknown[];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArgs) => void;
  }
}

export type GaItem = { item_id: string; quantity: number; price: number };
export type GaCartEvent = "view_cart" | "add_to_cart" | "begin_checkout";

const LIVE_HOSTS = ["galletisima.cl", "www.galletisima.cl"];
const PAGE_VIEW_EXACT = ["/", "/checkout", "/contacto", "/como-pedir", "/terminos-y-condiciones", "/politica-de-reembolso", "/politica-de-privacidad"];

// El tráfico de clientes: portada, productos, categorías, checkout y páginas informativas.
// Quedan fuera administración, pago y seguimiento de pedidos.
export function shouldTrackGaPageView(hostname: string, pathname: string) {
  return LIVE_HOSTS.includes(hostname)
    && (PAGE_VIEW_EXACT.includes(pathname) || pathname.startsWith("/producto/") || pathname.startsWith("/categoria/"));
}

let initialized = false;
let lastSearchTerm = "";

function initializeGa() {
  if (!LIVE_HOSTS.includes(window.location.hostname)) return false;
  if (!initialized) {
    window.dataLayer = window.dataLayer || [];
    // gtag.js solo reconoce comandos guardados como el objeto `arguments`;
    // si se guarda una lista normal los ignora y no envía nada.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    // La vista de página se envía a mano, solo con los parámetros de campaña.
    window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
    const script = document.createElement("script");
    script.id = "ga4-sdk";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
    initialized = true;
  }
  return Boolean(window.gtag);
}

// Parámetros de campaña que sí se envían, para que GA4 sepa de qué anuncio viene
// cada visita. Cualquier otro parámetro de la URL se descarta.
const CAMPAIGN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "gclid", "fbclid"];

export function campaignPageLocation(origin: string, pathname: string, search: string) {
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of CAMPAIGN_PARAMS) {
    const value = params.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return `${origin}${pathname}${query ? `?${query}` : ""}`;
}

export function trackGaPageView() {
  if (!shouldTrackGaPageView(window.location.hostname, window.location.pathname)) return;
  if (!initializeGa()) return;
  window.gtag?.("event", "page_view", {
    page_location: campaignPageLocation(window.location.origin, window.location.pathname, window.location.search),
    page_title: document.title,
  });
}

export function trackGaCartEvent(
  eventName: GaCartEvent,
  data: { contents: { id: string; quantity: number; item_price: number }[]; currency: string; value: number },
) {
  if (!initializeGa()) return;
  window.gtag?.("event", eventName, {
    currency: data.currency,
    value: data.value,
    items: data.contents.map((content): GaItem => ({ item_id: content.id, quantity: content.quantity, price: content.item_price })),
  });
}

export function trackGaPurchase(data: { transactionId: string; value: number; items: GaItem[] }) {
  if (!initializeGa()) return;
  window.gtag?.("event", "purchase", {
    transaction_id: data.transactionId,
    currency: "CLP",
    value: data.value,
    items: data.items,
  });
}

// Clic en una lámina de la portada (para saber cuál atrae más).
export function trackGaSelectPromotion(id: string, name: string) {
  if (!initializeGa()) return;
  window.gtag?.("event", "select_promotion", { promotion_id: id, promotion_name: name, creative_slot: "portada" });
}

// Lo que escriben las personas en los buscadores del sitio. `source` indica cuál:
// "encabezado", "catalogo" o "categoria".
export function trackGaSearch(term: string, source: string) {
  const clean = term.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 100);
  if (clean.length < 2 || clean === lastSearchTerm) return;
  if (!initializeGa()) return;
  lastSearchTerm = clean;
  window.gtag?.("event", "view_search_results", { search_term: clean, search_source: source });
}
