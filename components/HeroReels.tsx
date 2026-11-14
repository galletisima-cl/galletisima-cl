"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { HERO_REELS, HERO_REEL_INTERVAL_MS, HERO_REEL_SLIDE_MS, nextReelIndex, reelImages, type HeroReel } from "../lib/hero-reels";
import { productDisplayPrice } from "../lib/product-price";
import { trackGaSelectPromotion } from "../lib/analytics";

type Product = { id: string; slug: string; size: string; price: number; image_url: string | null; product_images: { image_url: string; sort_order: number }[] | null };

const money = (value: number) => `$${value.toLocaleString("es-CL")}`;

function ReelCard({ reel, images, price, index, playing }: { reel: HeroReel; images: string[]; price: number | null; index: number; playing: boolean }) {
  const [current, setCurrent] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!playing || images.length < 2) return;
    // Las láminas parten desfasadas para que no cambien todas al mismo tiempo.
    const start = window.setTimeout(() => {
      setCurrent((value) => (value + 1) % images.length);
      setCycle((value) => value + 1);
    }, HERO_REEL_INTERVAL_MS + index * 900);
    return () => window.clearTimeout(start);
  }, [playing, images.length, index, cycle]);

  return (
    <Link
      className={`hero-reel hero-reel-${reel.tone}`}
      href={reel.href}
      onClick={() => trackGaSelectPromotion(reel.id, reel.title)}
      aria-label={`${reel.title}${price ? `, desde ${money(price)}` : ""}. ${reel.cta}`}
    >
      <div className="hero-reel-progress" aria-hidden="true">
        {images.map((image, imageIndex) => (
          <span key={image} className={imageIndex < current ? "done" : imageIndex === current ? "active" : ""} style={{ animationDuration: `${HERO_REEL_INTERVAL_MS + index * 900}ms` }} />
        ))}
      </div>
      <div className="hero-reel-media" aria-hidden="true">
        {/* Fondo difuminado de la misma foto, para que el producto se vea completo sin bordes vacíos. */}
        {images[current] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`fondo-${images[current]}`} src={images[current]} alt="" className="hero-reel-backdrop" decoding="async" />
        )}
        {images.map((image, imageIndex) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={image}
            src={image}
            alt=""
            className={`hero-reel-photo ${imageIndex === current ? "visible" : ""}`}
            loading={imageIndex === 0 && index === 0 ? "eager" : "lazy"}
            decoding="async"
          />
        ))}
        {!images.length && <span className="hero-reel-empty">♡</span>}
      </div>
      <span className="hero-reel-badge">{reel.badge}</span>
      <div className="hero-reel-info">
        <strong>{reel.title}</strong>
        <small>{reel.note}</small>
        {price !== null && <b>{reel.productSlugs.length > 1 ? "Desde " : ""}{money(price)}</b>}
        <span className="hero-reel-cta">{reel.cta} <i aria-hidden="true">→</i></span>
      </div>
    </Link>
  );
}

export default function HeroReels() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sizePrices, setSizePrices] = useState<Record<string, Record<string, number>>>({});
  const [playing, setPlaying] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);

  useEffect(() => {
    const slugs = [...new Set(HERO_REELS.flatMap((reel) => reel.productSlugs))];
    const supabase = createClient();
    Promise.all([
      supabase.from("products").select("id,slug,size,price,image_url,product_images(image_url,sort_order)").in("slug", slugs).eq("active", true),
      supabase.from("site_settings").select("value").eq("key", "product_size_prices").maybeSingle(),
    ]).then(([productsResult, pricesResult]) => {
      setProducts((productsResult.data as Product[] | null) || []);
      try { setSizePrices(pricesResult.data?.value ? JSON.parse(pricesResult.data.value) : {}); } catch { setSizePrices({}); }
    });
    // Sin animación si la persona pidió reducir movimiento.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPlaying(!reduced.matches);
    sync();
    reduced.addEventListener("change", sync);
    return () => reduced.removeEventListener("change", sync);
  }, []);

  const reels = useMemo(() => HERO_REELS.map((reel) => {
    const reelProducts = products.filter((product) => reel.productSlugs.includes(product.slug));
    const prices = reelProducts.map((product) => productDisplayPrice(product, sizePrices));
    return { reel, images: reelImages(reel, products), price: prices.length ? Math.min(...prices) : null };
  }).filter((item) => !products.length || item.images.length), [products, sizePrices]);

  // En celular las láminas quedan en fila con deslizamiento lateral: avanzan solas
  // de una en una (y vuelven al inicio). Si la persona las desliza, se espera un rato.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !playing) return;
    const pause = () => { pausedUntil.current = Date.now() + 8000; };
    track.addEventListener("pointerdown", pause, { passive: true });
    track.addEventListener("touchstart", pause, { passive: true });
    track.addEventListener("wheel", pause, { passive: true });
    const timer = window.setInterval(() => {
      if (Date.now() < pausedUntil.current || document.hidden) return;
      if (track.scrollWidth <= track.clientWidth + 8) return; // en escritorio caben todas: no se mueve
      const cards = [...track.querySelectorAll<HTMLElement>(".hero-reel")];
      if (cards.length < 2) return;
      const offsets = cards.map((card) => card.offsetLeft - track.offsetLeft - (track.clientWidth - card.offsetWidth) / 2);
      const next = nextReelIndex(offsets, track.scrollLeft, track.scrollWidth - track.clientWidth);
      track.scrollTo({ left: Math.max(0, offsets[next]), behavior: "smooth" });
    }, HERO_REEL_SLIDE_MS);
    return () => {
      window.clearInterval(timer);
      track.removeEventListener("pointerdown", pause);
      track.removeEventListener("touchstart", pause);
      track.removeEventListener("wheel", pause);
    };
  }, [playing, reels.length]);

  return (
    <div className="hero-reels" ref={trackRef}>
      {reels.map(({ reel, images, price }, index) => (
        <ReelCard key={reel.id} reel={reel} images={images} price={price} index={index} playing={playing} />
      ))}
    </div>
  );
}
