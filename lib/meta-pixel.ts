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

// Only the live storefront reports visits. Payment and tracking URLs can carry
// private order tokens, and administrative activity is not customer traffic.
export function shouldTrackMetaPixel(hostname: string, pathname: string) {
  return ["galletisima.cl", "www.galletisima.cl"].includes(hostname)
    && (pathname === "/" || pathname.startsWith("/producto/")
      || ["/checkout", "/contacto", "/terminos-y-condiciones", "/politica-de-reembolso", "/politica-de-privacidad"].includes(pathname));
}
let initialized = false;
const trackedPurchases = new Set<string>();

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

export function trackMetaEvent(eventName: "ViewCart" | "AddToCart" | "InitiateCheckout", data: MetaCartEventData) {
  if (!shouldTrackMetaPixel(window.location.hostname, window.location.pathname)) return;
  if (!initializeMetaPixel()) return;
  if (eventName === "ViewCart") window.fbq?.("trackSingleCustom", META_PIXEL_ID, eventName, data);
  else window.fbq?.("trackSingle", META_PIXEL_ID, eventName, data);
}

export function trackMetaPurchase(orderId: string, data: MetaCartEventData) {
  if (window.location.pathname !== "/pago/resultado" || !initializeMetaPixel()) return;
  if (trackedPurchases.has(orderId)) return;
  const storageKey = `meta-purchase-tracked-${orderId}`;
  try {
    if (window.localStorage.getItem(storageKey)) return;
  } catch (error) {
    console.error("No se pudo verificar la deduplicación del evento Purchase de Meta", error);
  }
  trackedPurchases.add(orderId);
  window.fbq?.("trackSingle", META_PIXEL_ID, "Purchase", { ...data, order_id: orderId }, { eventID: orderId });
  try {
    window.localStorage.setItem(storageKey, "true");
  } catch (error) {
    console.error("No se pudo guardar la deduplicación del evento Purchase de Meta", error);
  }
}
