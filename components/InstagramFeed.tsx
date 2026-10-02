"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { instagramProfileUrl, safeInstagramProfile, type InstagramFeed as Feed, type InstagramPost } from "../lib/instagram-types";

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
  const rail = useRef<HTMLDivElement>(null);
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
  return <section className={`instagram-section shell${feed.posts.length ? " has-instagram-posts" : ""}`} aria-labelledby="instagram-title">
    <div className="instagram-feed-heading"><div><p className="eyebrow">INSPÍRATE CON NOSOTROS</p><h2 id="instagram-title">Galletísima en Instagram</h2><a className="instagram-feed-profile" href={url} target="_blank" rel="noopener noreferrer">@{username} ↗</a></div>
      <a className="button primary" href={url} target="_blank" rel="noopener noreferrer">VER INSTAGRAM <span>↗</span></a>
    </div>
    {feed.posts.length > 0 && <div className="instagram-feed-gallery">
      <div className="instagram-feed-controls"><button type="button" onClick={() => move(-1)} aria-label="Ver publicaciones anteriores de Instagram">←</button><button type="button" onClick={() => move(1)} aria-label="Ver más publicaciones de Instagram">→</button></div>
      <div className="instagram-posts" ref={rail} role="group" aria-label="Últimas publicaciones de Instagram">{feed.posts.map(post => <InstagramTile post={post} key={`${post.id}-${post.imageUrl}`} />)}</div>
    </div>}
  </section>;
}
