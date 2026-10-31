"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { INSTAGRAM_EMBEDS_SETTING_KEY, readInstagramEmbedSetting } from "../lib/instagram-embeds";
import { instagramProfileUrl, safeInstagramProfile, type InstagramFeed as Feed, type InstagramPost } from "../lib/instagram-types";
import { createClient } from "../lib/supabase/client";

declare global {
  interface Window { instgrm?: { Embeds: { process: () => void } } }
}

const EMBED_SCRIPT_ID = "instagram-embed-script";

// Carga el script oficial de Instagram una sola vez y procesa las inserciones.
function processInstagramEmbeds() {
  if (window.instgrm) { window.instgrm.Embeds.process(); return; }
  if (document.getElementById(EMBED_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = EMBED_SCRIPT_ID;
  script.src = "https://www.instagram.com/embed.js";
  script.async = true;
  script.onload = () => window.instgrm?.Embeds.process();
  document.body.appendChild(script);
}

// El script de Instagram reemplaza el blockquote por un iframe, así que React no
// administra su contenido. Las URL ya vienen normalizadas (solo letras, números, _ y -).
function InstagramEmbed({ url }: { url: string }) {
  const html = `<blockquote class="instagram-media" data-instgrm-permalink="${url}?utm_source=ig_embed" data-instgrm-version="14"><a href="${url}" target="_blank" rel="noopener noreferrer">Ver esta publicación en Instagram ↗</a></blockquote>`;
  return <div className="instagram-embed" dangerouslySetInnerHTML={{ __html: html }} />;
}

function InstagramTile({ post }: { post: InstagramPost }) {
  const [failed, setFailed] = useState(false);
  const label = post.caption.trim().slice(0, 140) || "Publicación de Galletísima";
  return <a className="instagram-post" href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label={`${label}. Abrir en Instagram`}>
    {post.imageUrl && !failed ? <Image src={post.imageUrl} alt="" width={260} height={260} unoptimized onError={() => setFailed(true)} /> : <span className="instagram-post-placeholder">Ver publicación<br />en Instagram ↗</span>}
    {post.type !== "IMAGE" && <span className="instagram-post-type" aria-hidden="true">{post.type === "VIDEO" ? "▶" : "▣"}</span>}
    <span className="instagram-post-overlay" aria-hidden="true">Ver en Instagram ↗</span>
  </a>;
}

export default function InstagramFeed({ profileUrl }: { profileUrl: string }) {
  const [feed, setFeed] = useState<Feed>({ username: null, posts: [] });
  const [embeds, setEmbeds] = useState<string[]>([]);
  const rail = useRef<HTMLDivElement>(null);
  // Nodo de la sección en estado (no en ref): la sección aparece recién cuando
  // llega el enlace del perfil, y el efecto de abajo debe volver a correr entonces.
  const [sectionNode, setSectionNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    void createClient().from("site_settings").select("value").eq("key", INSTAGRAM_EMBEDS_SETTING_KEY).maybeSingle().then(({ data }) => {
      if (active) setEmbeds(readInstagramEmbedSetting(data?.value));
    }, () => {});
    return () => { active = false; };
  }, []);
  // El script de Instagram es pesado: se carga solo cuando la sección está por aparecer.
  useEffect(() => {
    const node = sectionNode;
    if (!embeds.length || !node) return;
    if (!("IntersectionObserver" in window)) { processInstagramEmbeds(); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); processInstagramEmbeds(); }
    }, { rootMargin: "600px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [embeds, sectionNode]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/instagram/feed", { signal: controller.signal }).then(response => response.ok ? response.json() : null).then(data => {
      if (data && Array.isArray(data.posts)) setFeed(data);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const url = (feed.username && instagramProfileUrl(feed.username)) || safeInstagramProfile(profileUrl);
  if (!url) return null;
  const username = feed.username || new URL(url).pathname.split("/").filter(Boolean)[0];
  const move = (direction: number) => {
    if (!rail.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.current.scrollBy({ left: rail.current.clientWidth * direction, behavior: reducedMotion ? "instant" : "smooth" });
  };
  const showEmbeds = embeds.length > 0;
  return <section ref={setSectionNode} className={`instagram-section shell${showEmbeds || feed.posts.length ? " has-instagram-posts" : ""}`} aria-labelledby="instagram-title">
    <div className="instagram-feed-heading"><div><p className="eyebrow">INSPÍRATE CON NOSOTROS</p><h2 id="instagram-title">Galletísima en Instagram</h2><a className="instagram-feed-profile" href={url} target="_blank" rel="noopener noreferrer">@{username} ↗</a></div>
      <a className="button primary" href={url} target="_blank" rel="noopener noreferrer">VER INSTAGRAM <span>↗</span></a>
    </div>
    {showEmbeds && <div className="instagram-feed-gallery">
      {embeds.length > 1 && <div className="instagram-feed-controls"><button type="button" onClick={() => move(-1)} aria-label="Ver publicaciones anteriores de Instagram">←</button><button type="button" onClick={() => move(1)} aria-label="Ver más publicaciones de Instagram">→</button></div>}
      <div className="instagram-embeds" ref={rail} role="group" aria-label="Publicaciones de Instagram">{embeds.map(url => <InstagramEmbed url={url} key={url} />)}</div>
    </div>}
    {!showEmbeds && feed.posts.length > 0 && <div className="instagram-feed-gallery">
      <div className="instagram-feed-controls"><button type="button" onClick={() => move(-1)} aria-label="Ver publicaciones anteriores de Instagram">←</button><button type="button" onClick={() => move(1)} aria-label="Ver más publicaciones de Instagram">→</button></div>
      <div className="instagram-posts" ref={rail} role="group" aria-label="Últimas publicaciones de Instagram">{feed.posts.map(post => <InstagramTile post={post} key={`${post.id}-${post.imageUrl}`} />)}</div>
    </div>}
  </section>;
}
