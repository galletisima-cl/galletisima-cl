import { createClient } from "@supabase/supabase-js";
import { instagramProfileUrl, type InstagramFeed, type InstagramPost } from "./instagram-types";

export function instagramDatabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function instagramConfig() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const secret = process.env.INSTAGRAM_APP_SECRET;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!appId || !secret || !site) return null;
  try {
    const redirect = new URL(process.env.INSTAGRAM_REDIRECT_URI || `${site.replace(/\/$/, "")}/api/instagram/callback`);
    if ((redirect.protocol !== "https:" && !(redirect.protocol === "http:" && ["localhost", "127.0.0.1"].includes(redirect.hostname))) || redirect.username || redirect.password || redirect.search || redirect.hash) return null;
    const version = process.env.INSTAGRAM_GRAPH_API_VERSION || "v25.0";
    if (!/^v\d+\.\d+$/.test(version)) return null;
    return { appId, secret, redirectUri: redirect.href, origin: redirect.origin, version };
  } catch { return null; }
}

export async function instagramAdmin(request: Request) {
  const token = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return null;
  const db = instagramDatabase();
  const { data, error } = await db.auth.getUser(token);
  return !error && data.user?.app_metadata.role === "admin" ? { db, userId: data.user.id } : null;
}

class InstagramError extends Error {
  code: string;
  constructor(code: string) { super("Instagram no está disponible."); this.code = code; }
}

async function instagramJson(url: string | URL, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
  const data = await response.json();
  if (!response.ok || data.error) throw new InstagramError(data.error?.code === 190 || response.status === 401 ? "reconnect" : "unavailable");
  return data;
}

export async function exchangeInstagramCode(code: string) {
  const config = instagramConfig();
  if (!config) throw new Error("Falta configurar la aplicación de Instagram.");
  const form = new FormData();
  for (const [key, value] of Object.entries({ client_id: config.appId, client_secret: config.secret, grant_type: "authorization_code", redirect_uri: config.redirectUri, code })) form.set(key, value);
  const response = await instagramJson("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  const short = response.access_token ? response : Array.isArray(response.data) && response.data.length === 1 ? response.data[0] : null;
  if (typeof short?.access_token !== "string") throw new InstagramError("reconnect");
  const exchange = new URL("https://graph.instagram.com/access_token");
  exchange.search = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: config.secret, access_token: short.access_token }).toString();
  const token = await instagramJson(exchange);
  if (typeof token.access_token !== "string" || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new InstagramError("reconnect");
  const profile = await instagramJson(`https://graph.instagram.com/${config.version}/me?fields=user_id,username`, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!/^\d+$/.test(String(profile.user_id)) || typeof profile.username !== "string" || !instagramProfileUrl(profile.username)) throw new InstagramError("reconnect");
  return { account_id: String(profile.user_id), username: profile.username as string, access_token: token.access_token as string, expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString() };
}

function imageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    // Read media directly from Meta's CDN; never proxy arbitrary remote URLs.
    return url.protocol === "https:" && !url.username && !url.password && ["cdninstagram.com", "fbcdn.net", "instagram.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null;
  } catch { return null; }
}

export function normalizeInstagramPosts(value: unknown): InstagramPost[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item): InstagramPost[] => {
    if (!item || typeof item.id !== "string" || seen.has(item.id) || !["IMAGE", "VIDEO", "CAROUSEL_ALBUM"].includes(item.media_type)) return [];
    let permalink: URL;
    try { permalink = new URL(item.permalink); } catch { return []; }
    if (permalink.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(permalink.hostname) || permalink.username || permalink.password || !/^\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(permalink.pathname)) return [];
    permalink.search = ""; permalink.hash = "";
    seen.add(item.id);
    return [{ id: item.id, caption: typeof item.caption === "string" ? item.caption.slice(0, 2200) : "", imageUrl: imageUrl(item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url), permalink: permalink.href, type: item.media_type, timestamp: typeof item.timestamp === "string" ? item.timestamp : "" }];
  }).slice(0, 12);
}

type Connection = {
  id: boolean; connection_id: string; account_id: string; username: string; access_token: string; expires_at: string;
  posts: InstagramPost[]; synced_at: string | null; checked_at: string | null; sync_lock_until: string; last_error: string | null;
};
const freshness = 15 * 60 * 1000;
const maxStale = 24 * 60 * 60 * 1000;
const emptyFeed: InstagramFeed = { username: null, posts: [] };

function publicFeed(connection: Connection): InstagramFeed {
  if (connection.last_error === "reconnect" || Date.parse(connection.expires_at) <= Date.now()) return emptyFeed;
  return { username: connection.username, posts: connection.synced_at && Date.now() - Date.parse(connection.synced_at) < maxStale ? connection.posts : [] };
}

export async function loadInstagramFeed(force = false): Promise<InstagramFeed> {
  const config = instagramConfig();
  if (!config) return emptyFeed;
  const db = instagramDatabase();
  const { data, error } = await db.from("instagram_connection").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error("No se pudo leer la conexión de Instagram.");
  if (!data) return emptyFeed;
  let connection = data as Connection;
  if (connection.last_error === "reconnect" || Date.parse(connection.expires_at) <= Date.now()) return emptyFeed;
  if (!force && connection.checked_at && Date.now() - Date.parse(connection.checked_at) < freshness) return publicFeed(connection);
  const { data: locked, error: lockError } = await db.from("instagram_connection")
    .update({ sync_lock_until: new Date(Date.now() + 45000).toISOString(), checked_at: new Date().toISOString() })
    .eq("id", true).eq("connection_id", connection.connection_id).lt("sync_lock_until", new Date().toISOString()).select("id").maybeSingle();
  if (lockError) throw new Error("No se pudo actualizar Instagram.");
  if (!locked) return publicFeed(connection);
  try {
    // Refresh on visits, well before expiration; no background scheduler is required.
    if (Date.parse(connection.expires_at) - Date.now() < 30 * 24 * 60 * 60 * 1000) {
      const refresh = new URL("https://graph.instagram.com/refresh_access_token");
      refresh.search = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: connection.access_token }).toString();
      const renewed = await instagramJson(refresh);
      if (typeof renewed.access_token !== "string" || !Number.isFinite(renewed.expires_in) || renewed.expires_in <= 0) throw new InstagramError("reconnect");
      const patch = { access_token: renewed.access_token, expires_at: new Date(Date.now() + renewed.expires_in * 1000).toISOString() };
      const { error: tokenError } = await db.from("instagram_connection").update(patch).eq("id", true).eq("connection_id", connection.connection_id);
      if (tokenError) throw new Error("No se pudo guardar la renovación.");
      connection = { ...connection, ...patch };
    }
    const media = new URL(`https://graph.instagram.com/${config.version}/${connection.account_id}/media`);
    media.search = new URLSearchParams({ fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp", limit: "12" }).toString();
    const response = await instagramJson(media, { headers: { Authorization: `Bearer ${connection.access_token}` } });
    if (!Array.isArray(response.data)) throw new InstagramError("unavailable");
    const patch = { posts: normalizeInstagramPosts(response.data), synced_at: new Date().toISOString(), last_error: null, sync_lock_until: new Date(0).toISOString() };
    const { data: saved, error: saveError } = await db.from("instagram_connection").update(patch).eq("id", true).eq("connection_id", connection.connection_id).select("id").maybeSingle();
    if (saveError) throw new Error("No se pudieron guardar las publicaciones.");
    // A disconnect/reconnect while fetching must not restore the old feed.
    return saved ? publicFeed({ ...connection, ...patch }) : emptyFeed;
  } catch (caught) {
    const code = caught instanceof InstagramError ? caught.code : "unavailable";
    const patch = { last_error: code, sync_lock_until: new Date(0).toISOString(), ...(code === "reconnect" ? { posts: [], synced_at: null } : {}) };
    await db.from("instagram_connection").update(patch).eq("id", true).eq("connection_id", connection.connection_id);
    return publicFeed({ ...connection, ...patch });
  }
}
