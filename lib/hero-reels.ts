// Láminas grandes tipo Reel de Instagram que reemplazan el banner de la portada.
// Cada lámina pasa sola las fotos de sus productos y lleva al producto al hacer clic.
// Para cambiar la portada de temporada basta con editar esta lista.

export type HeroReel = {
  id: string;
  title: string;
  /** Texto corto sobre la foto, arriba a la izquierda. */
  badge: string;
  /** Línea bajo el título. */
  note: string;
  /** Productos cuyas fotos se muestran (por slug), en orden. */
  productSlugs: string[];
  /** A dónde lleva el clic. */
  href: string;
  /** Color de la lámina: "navidad" (rojo y verde), "jengibre" o "snoopy" (amarillo). */
  tone: "navidad" | "jengibre" | "snoopy";
  cta: string;
};

export const HERO_REELS: HeroReel[] = [
  {
    id: "adviento",
    title: "Calendarios de Adviento",
    badge: "🚚 Envío gratis",
    note: "Pídelo antes del 20 de noviembre",
    productSlugs: ["calendario-de-adviento-1", "calendario-de-adviento-2"],
    href: "/categoria/calendarios-de-adviento",
    tone: "navidad",
    cta: "Haz clic y elige el tuyo",
  },
  {
    id: "jengibre",
    title: "Casitas de Jengibre",
    badge: "🏠 2 sets",
    note: "Arma tu casita de galleta",
    productSlugs: ["set-casita-jengibre", "set-solo-cutter-casa-jengibre"],
    href: "/categoria/casitas-de-jengibre",
    tone: "jengibre",
    cta: "Haz clic y ármala",
  },
  {
    id: "snoopy",
    title: "Casita de Snoopy",
    badge: "✨ Nuevo",
    note: "La casita roja más tierna",
    productSlugs: ["set-casita-de-snoopy"],
    href: "/producto/set-casita-de-snoopy",
    tone: "snoopy",
    cta: "Haz clic y descúbrela",
  },
];

/** Cada cuánto cambia la foto dentro de una lámina. */
export const HERO_REEL_INTERVAL_MS = 3200;

/** En celular, cada cuánto el carrusel pasa a la siguiente lámina. */
export const HERO_REEL_SLIDE_MS = 4000;

/**
 * Siguiente lámina del carrusel en celular: la que sigue a la más cercana a la
 * posición actual, o la primera si ya se llegó al final.
 */
export function nextReelIndex(offsets: number[], scrollLeft: number, maxScroll: number) {
  if (!offsets.length) return 0;
  if (scrollLeft >= maxScroll - 4) return 0;
  let current = 0;
  offsets.forEach((offset, index) => {
    if (Math.abs(Math.max(0, offset) - scrollLeft) < Math.abs(Math.max(0, offsets[current]) - scrollLeft)) current = index;
  });
  return current + 1 >= offsets.length ? 0 : current + 1;
}

type ProductWithImages = { slug: string; price: number; image_url: string | null; product_images?: { image_url: string; sort_order: number }[] | null };

/**
 * Fotos de una lámina: alterna las fotos de sus productos (1ª del primero,
 * 1ª del segundo, 2ª del primero…) para que se vean todos desde el inicio.
 */
export function reelImages(reel: Pick<HeroReel, "productSlugs">, products: ProductWithImages[], max = 6) {
  const lists = reel.productSlugs
    .map((slug) => products.find((product) => product.slug === slug))
    .filter((product): product is ProductWithImages => Boolean(product))
    .map((product) => {
      const gallery = [...(product.product_images || [])].sort((a, b) => a.sort_order - b.sort_order).map((image) => image.image_url);
      return gallery.length ? gallery : product.image_url ? [product.image_url] : [];
    });
  const images: string[] = [];
  for (let index = 0; images.length < max && lists.some((list) => index < list.length); index += 1) {
    for (const list of lists) if (list[index] && images.length < max && !images.includes(list[index])) images.push(list[index]);
  }
  return images;
}
