"use client";

/**
 * Animación de aparición al hacer scroll (fade + leve desplazamiento).
 *
 * Dos formas de usarla, ambas con los estilos de `animaciones.css`:
 *
 * 1) <Reveal delay={80}>…</Reveal>
 *    Envoltorio para componentes cliente o secciones nuevas.
 *
 * 2) <ScrollReveal /> una sola vez en app/layout.tsx, y luego `data-reveal`
 *    en cualquier elemento de páginas de servidor, sin cambiar su estructura:
 *      <article className="product-card" data-reveal data-reveal-delay="60">
 *
 * Solo anima opacidad y posición. Con "reducir movimiento" activado, o sin
 * JavaScript, el contenido se ve normal desde el inicio (lo decide el CSS).
 */

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Retraso en milisegundos, útil para escalonar tarjetas. */
  delay?: number;
  /** Etiqueta HTML a renderizar. Por defecto "div". */
  as?: ElementType;
  /** Porción visible necesaria para disparar (0 a 1). */
  threshold?: number;
};

export default function Reveal({ children, className = "", delay = 0, as = "div", threshold = 0.15 }: RevealProps) {
  const Tag = as;
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const style = { "--reveal-delay": `${delay}ms` } as CSSProperties;
  return (
    <Tag ref={ref} className={`reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </Tag>
  );
}

/** Revela todo elemento con `data-reveal`, también los que aparecen después (navegación, paginación). */
export function ScrollReveal() {
  useEffect(() => {
    const reveal = (el: Element) => el.classList.add("is-visible");

    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll("[data-reveal]").forEach(reveal);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target);
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    const watched = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)").forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        if (el.dataset.revealDelay) el.style.setProperty("--reveal-delay", `${el.dataset.revealDelay}ms`);
        io.observe(el);
      });
    };

    let frame = 0;
    const scheduleScan = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    };

    scan();
    const mutations = new MutationObserver(scheduleScan);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      mutations.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
