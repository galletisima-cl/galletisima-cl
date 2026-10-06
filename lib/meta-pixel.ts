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

// Only the live storefront reports visits. Payment and tracking URLs can carry
// private order tokens, and administrative activity is not customer traffic.
export function shouldTrackMetaPixel(hostname: string, pathname: string) {
  return ["galletisima.cl", "www.galletisima.cl"].includes(hostname)
    && (pathname === "/" || pathname.startsWith("/producto/")
      || ["/checkout", "/contacto", "/terminos-y-condiciones", "/politica-de-reembolso", "/politica-de-privacidad"].includes(pathname));
}

let initialized = false;

export function trackMetaPageView() {
  if (!shouldTrackMetaPixel(window.location.hostname, window.location.pathname)) return;

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

  if (!initialized) {
    // Next.js navigation is tracked below, so disable Meta's history listener.
    window.fbq.disablePushState = true;
    window.fbq("set", "autoConfig", false, META_PIXEL_ID);
    window.fbq("init", META_PIXEL_ID);
    initialized = true;
  }
  window.fbq("trackSingle", META_PIXEL_ID, "PageView");
}
