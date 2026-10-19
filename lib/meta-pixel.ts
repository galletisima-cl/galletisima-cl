export const META_PIXEL_ID = "986368890452042";

type PixelCommand = unknown[];
type MetaPixel = {
  (...args: PixelCommand): void;
  callMethod?: (...args: PixelCommand) => void;
  queue: PixelCommand[];
  push: MetaPixel;
  loaded: boolean;
  version: string;
  disablePushState: boolean;
};

declare global {
  interface Window {
    fbq?: MetaPixel;
    _fbq?: MetaPixel;
  }
}

export type MetaContent = {
  id: string;
  quantity: number;
  item_price: number;
};

export type MetaCartEventData = {
  content_ids: string[];
  contents: MetaContent[];
  content_type: "product";
  currency: "CLP";
  num_items: number;
  value: number;
};

export type MetaBrowserEventName = "ViewCart" | "AddToCart" | "InitiateCheckout";

// Only the live storefront reports visits. Payment and tracking URLs can carry
// private order tokens, and administrative activity is not customer traffic.
export function shouldTrackMetaPixel(hostname: string, pathname: string) {
  return ["galletisima.cl", "www.galletisima.cl"].includes(hostname)
    && (pathname === "/" || pathname.startsWith("/producto/")
      || ["/checkout", "/contacto", "/terminos-y-condiciones", "/politica-de-reembolso", "/politica-de-privacidad"].includes(pathname));
}
let initialized = false;

function initializeMetaPixel() {
  if (!["galletisima.cl", "www.galletisima.cl"].includes(window.location.hostname)) return false;
  if (!window.fbq) {
    const pixel: MetaPixel = Object.assign(
      (...args: PixelCommand) => {
        if (pixel.callMethod) pixel.callMethod(...args);
        else pixel.queue.push(args);
      },
      { queue: [] as PixelCommand[], loaded: true, version: "2.0", disablePushState: true },
    ) as MetaPixel;
    pixel.push = pixel;
    window.fbq = pixel;
    window._fbq = pixel;

    const script = document.createElement("script");
    script.id = "meta-pixel-sdk";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  const pixel = window.fbq;
  if (!pixel) return false;

  if (!initialized) {
    pixel.disablePushState = true;
    pixel("set", "autoConfig", false, META_PIXEL_ID);
    pixel("init", META_PIXEL_ID);
    initialized = true;
  }
  return true;
}

export function trackMetaPageView() {
  if (!shouldTrackMetaPixel(window.location.hostname, window.location.pathname)) return;
  if (!initializeMetaPixel()) return;
  window.fbq?.("trackSingle", META_PIXEL_ID, "PageView");
}

export function trackMetaEvent(eventName: MetaBrowserEventName, data: MetaCartEventData) {
  if (!shouldTrackMetaPixel(window.location.hostname, window.location.pathname)) return;
  if (!initializeMetaPixel()) return;
  const eventId = crypto.randomUUID();
  if (eventName === "ViewCart") window.fbq?.("trackSingleCustom", META_PIXEL_ID, eventName, data, { eventID: eventId });
  else window.fbq?.("trackSingle", META_PIXEL_ID, eventName, data, { eventID: eventId });
  void fetch("/api/meta/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_source_url: `${window.location.origin}${window.location.pathname}`,
      custom_data: data,
    }),
    keepalive: true,
  }).then(async (response) => {
    if (!response.ok) console.error("Meta Conversions API rechazó el evento", eventName, response.status, await response.text());
  }).catch((error: unknown) => {
    console.error("No se pudo enviar el evento a Meta Conversions API", eventName, error);
  });
}
