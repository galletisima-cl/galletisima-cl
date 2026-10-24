"use client";

/**
 * Sección "Clientas felices".
 *
 * - Tarjetas pequeñas (solo portada liviana). El video se descarga recién
 *   cuando la clienta toca una tarjeta.
 * - Al tocar, la tarjeta se agranda en una ventana con el video en grande
 *   (se reproduce solo y en silencio). Flechas o ← → para pasar de una a otra,
 *   Esc, la X o tocar afuera para cerrar.
 * - El carrusel es infinito: se puede deslizar sin fin hacia los dos lados
 *   (la lista va repetida 3 veces con las mismas imágenes, que el navegador
 *   descarga una sola vez, y al llegar al borde se reubica sin que se note).
 * - Además avanza solo, lento. Se detiene al pasar el mouse, al tocar, al
 *   enfocar con teclado, mientras hay una reseña abierta; y no consume nada
 *   cuando la sección no se ve o la pestaña está en segundo plano.
 * - Con "reducir movimiento" o "ahorro de datos" no avanza solo ni anima la
 *   apertura, pero igual se puede deslizar sin fin a mano.
 * - Para ocultar una reseña basta poner "publicar": false en resenas.json.
 */

import { useEffect, useRef, useState } from "react";
import Reveal from "./Reveal";
import resenas from "./resenas.json";

type Resena = {
  id: string;
  orden: number;
  publicar: boolean;
  titulo: string;
  video: string;
  poster: string;
};

const resenasPublicas: Resena[] = (resenas as Resena[])
  .filter((resena) => resena.publicar)
  .sort((a, b) => a.orden - b.orden);

/** Velocidad del carrusel en píxeles por segundo. */
const VELOCIDAD = 32;
/** Pausa tras tocar, arrastrar o usar la rueda, en milisegundos. */
const PAUSA_TRAS_INTERACCION = 3000;

/** Ancho de un juego completo de tarjetas (distancia entre el original y su copia siguiente). */
function medirBucle(track: HTMLElement) {
  const first = track.querySelector<HTMLElement>("[data-cf-first]");
  const next = track.querySelector<HTMLElement>("[data-cf-next]");
  return first && next ? next.offsetLeft - first.offsetLeft : 0;
}

function ResenaDialog({
  index,
  originRect,
  reduceMotion,
  onClose,
  onNavigate,
}: {
  index: number;
  originRect: DOMRect | null;
  reduceMotion: boolean;
  onClose: () => void;
  onNavigate: (delta: 1 | -1) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const navigateRef = useRef(onNavigate);
  const [paused, setPaused] = useState(false);
  const resena = resenasPublicas[index];

  useEffect(() => {
    navigateRef.current = onNavigate;
  }, [onNavigate]);

  // Se monta al abrir y se desmonta al cerrar: abrir = showModal().
  useEffect(() => {
    const dialog = dialogRef.current;
    const stage = stageRef.current;
    if (!dialog) return;
    // En desarrollo React monta dos veces; un "close" tardío del primer montaje no debe cerrar la ventana.
    const handleClose = () => {
      if (!dialog.open) onClose();
    };
    // Flechas del teclado y clic en el fondo (cualquier elemento con data-close).
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") navigateRef.current(1);
      else if (event.key === "ArrowLeft") navigateRef.current(-1);
    };
    const handleClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).hasAttribute("data-close")) dialog.close();
    };
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("keydown", handleKey);
    dialog.addEventListener("click", handleClick);
    if (!dialog.open) dialog.showModal();

    // La tarjeta "se agranda": el video parte con el tamaño y lugar de la miniatura.
    if (stage && originRect && !reduceMotion && typeof stage.animate === "function") {
      const to = stage.getBoundingClientRect();
      if (to.width > 0) {
        const dx = originRect.left + originRect.width / 2 - (to.left + to.width / 2);
        const dy = originRect.top + originRect.height / 2 - (to.top + to.height / 2);
        const scale = originRect.width / to.width;
        stage.animate(
          [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: "translate(0, 0) scale(1)" }],
          { duration: 340, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
        );
      }
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("keydown", handleKey);
      dialog.removeEventListener("click", handleClick);
    };
    // Se ejecuta una sola vez por apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada vez que cambia la reseña, el video nuevo parte solo.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().catch(() => undefined);
  }, [resena.id]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  return (
    <dialog
      ref={dialogRef}
      className="cf-dialog"
      aria-label={`Reseña: ${resena.titulo}`}
      data-close
    >
      <div className="cf-dialog-inner" data-close>
        <button type="button" className="cf-close cf-ui" aria-label="Cerrar" onClick={() => dialogRef.current?.close()}>
          ✕
        </button>
        <button type="button" className="cf-arrow cf-prev cf-ui" aria-label="Reseña anterior" onClick={() => onNavigate(-1)}>
          ‹
        </button>
        <div className="cf-stage" ref={stageRef}>
          <video
            key={resena.id}
            ref={videoRef}
            className="cf-big"
            src={resena.video}
            poster={resena.poster}
            muted
            loop
            playsInline
            autoPlay
            aria-label={resena.titulo}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
          />
          <button type="button" className="cf-bigtoggle" onClick={togglePlay} aria-label={paused ? "Reproducir" : "Pausar"}>
            <span className={`cf-bigplay${paused ? " is-on" : ""}`} aria-hidden="true">
              ▶
            </span>
          </button>
        </div>
        <p className="cf-dialog-caption cf-ui">{resena.titulo}</p>
        <button type="button" className="cf-arrow cf-next cf-ui" aria-label="Reseña siguiente" onClick={() => onNavigate(1)}>
          ›
        </button>
      </div>
    </dialog>
  );
}

export default function ClientasFelices({
  titulo = "Clientas felices",
  subtitulo = "Historias reales de quienes ya recibieron sus cortadores. Toca una para verla en grande.",
}: {
  titulo?: string;
  subtitulo?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef<number | null>(null);
  const [auto, setAuto] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    openRef.current = openIndex;
  }, [openIndex]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const update = () => {
      setReduceMotion(query.matches);
      setAuto(!query.matches && !nav.connection?.saveData);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Carrusel infinito: la lista va 3 veces [copia | original | copia]. Se parte en el
  // juego del medio y, al acercarse a un borde, se salta un juego completo (idéntico, no se nota).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const normalize = () => {
      const loop = medirBucle(track);
      if (loop <= 0) return;
      const left = track.scrollLeft;
      if (left < loop * 0.5) track.scrollLeft = left + loop;
      else if (left >= loop * 1.5) track.scrollLeft = left - loop;
    };

    track.scrollLeft = medirBucle(track);
    track.addEventListener("scroll", normalize, { passive: true });
    return () => track.removeEventListener("scroll", normalize);
  }, []);

  // Avance automático. Solo corre mientras la sección se ve (si no, no gasta nada).
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !auto) return;

    let frame = 0;
    let last = 0;
    let pos = track.scrollLeft;
    let holdUntil = 0;
    let hovering = false;
    let focused = false;

    const hold = () => {
      holdUntil = performance.now() + PAUSA_TRAS_INTERACCION;
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hovering = true;
    };
    const leave = () => {
      hovering = false;
    };
    const focusIn = () => {
      focused = true;
    };
    const focusOut = () => {
      focused = false;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = last ? Math.min(now - last, 64) : 0;
      last = now;

      // Si la posición cambió por fuera se respeta: un arrastre, la rueda o las flechas
      // pausan el avance; el salto interno del bucle infinito (un juego exacto) no.
      const diff = Math.abs(track.scrollLeft - pos);
      if (diff > 2) {
        const loop = medirBucle(track);
        const salto = loop > 0 && Math.abs(diff - loop) <= 2;
        pos = track.scrollLeft;
        if (!salto) holdUntil = now + PAUSA_TRAS_INTERACCION;
      }
      if (hovering || focused || openRef.current !== null || now < holdUntil) return;

      pos += (VELOCIDAD * dt) / 1000;
      track.scrollLeft = pos;
    };

    const start = () => {
      if (frame) return;
      last = 0;
      pos = track.scrollLeft;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    if (observer) observer.observe(track);
    else start();

    track.addEventListener("pointerenter", enter);
    track.addEventListener("pointerleave", leave);
    track.addEventListener("pointerdown", hold);
    track.addEventListener("touchstart", hold, { passive: true });
    track.addEventListener("wheel", hold, { passive: true });
    track.addEventListener("focusin", focusIn);
    track.addEventListener("focusout", focusOut);

    return () => {
      stop();
      observer?.disconnect();
      track.removeEventListener("pointerenter", enter);
      track.removeEventListener("pointerleave", leave);
      track.removeEventListener("pointerdown", hold);
      track.removeEventListener("touchstart", hold);
      track.removeEventListener("wheel", hold);
      track.removeEventListener("focusin", focusIn);
      track.removeEventListener("focusout", focusOut);
    };
  }, [auto]);

  if (resenasPublicas.length === 0) return null;

  const total = resenasPublicas.length;
  const openAt = (index: number, element: HTMLElement) => {
    setOriginRect(element.getBoundingClientRect());
    setOpenIndex(index);
  };
  const navigate = (delta: 1 | -1) => {
    setOriginRect(null);
    setOpenIndex((current) => (current === null ? current : (current + delta + total) % total));
  };

  // Flechas: se anima con scrollLeft relativo para no chocar con el salto del bucle infinito.
  const scrollTrack = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const distance = direction * track.clientWidth * 0.7;
    if (reduceMotion) {
      track.scrollLeft += distance;
      return;
    }
    const startTime = performance.now();
    let applied = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / 450);
      const target = distance * (1 - Math.pow(1 - t, 3));
      track.scrollLeft += target - applied;
      applied = target;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // set 0 = copia anterior, set 1 = original, set 2 = copia siguiente.
  const renderSlide = (resena: Resena, index: number, set: 0 | 1 | 2) => {
    const copy = set !== 1;
    return (
      <div
        className="cf-slide"
        key={`${set}-${resena.id}`}
        role={copy ? undefined : "listitem"}
        aria-hidden={copy ? true : undefined}
        inert={copy ? true : undefined}
        data-cf-first={set === 1 && index === 0 ? "" : undefined}
        data-cf-next={set === 2 && index === 0 ? "" : undefined}
      >
        <button
          type="button"
          className="cf-thumb"
          aria-haspopup="dialog"
          aria-label={`Ver reseña: ${resena.titulo}`}
          onClick={(event) => openAt(index, event.currentTarget)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resena.poster} alt="" width={576} height={1024} loading="lazy" decoding="async" />
          <span className="cf-play" aria-hidden="true">
            ▶
          </span>
        </button>
      </div>
    );
  };

  return (
    <section className="cf-section" aria-labelledby="cf-titulo">
      <Reveal className="cf-head">
        <div>
          <h2 id="cf-titulo" className="cf-title">
            {titulo} <span aria-hidden="true">💜</span>
          </h2>
          <p className="cf-sub">{subtitulo}</p>
        </div>
        <div className="cf-nav">
          <button type="button" className="cf-navbtn" onClick={() => scrollTrack(-1)} aria-label="Ver anteriores">
            ‹
          </button>
          <button type="button" className="cf-navbtn" onClick={() => scrollTrack(1)} aria-label="Ver siguientes">
            ›
          </button>
        </div>
      </Reveal>
      <Reveal delay={120}>
        <div className="cf-track" ref={trackRef} role="list">
          {([0, 1, 2] as const).flatMap((set) => resenasPublicas.map((resena, index) => renderSlide(resena, index, set)))}
        </div>
      </Reveal>
      {openIndex !== null && (
        <ResenaDialog
          index={openIndex}
          originRect={originRect}
          reduceMotion={reduceMotion}
          onClose={() => setOpenIndex(null)}
          onNavigate={navigate}
        />
      )}
    </section>
  );
}
