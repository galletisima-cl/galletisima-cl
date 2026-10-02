import { createClient } from "@supabase/supabase-js";
import { instagramProfileUrl, type InstagramFeed, type InstagramPost } from "./instagram-types";

export function instagramDatabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type InstagramProvider = "instagram" | "facebook";

export function instagramAccessExpired(expiresAt: string | null, provider: InstagramProvider = "instagram") {
  if (expiresAt === null) return provider !== "facebook";
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= Date.now();
}

export function instagramConfig(provider: InstagramProvider = "instagram") {
  const appId = provider === "facebook" ? process.env.INSTAGRAM_FACEBOOK_APP_ID : process.env.INSTAGRAM_APP_ID;
  const secret = provider === "facebook" ? process.env.INSTAGRAM_FACEBOOK_APP_SECRET : process.env.INSTAGRAM_APP_SECRET;
  const configId = process.env.INSTAGRAM_FACEBOOK_CONFIG_ID;
  const accountId = process.env.INSTAGRAM_FACEBOOK_ACCOUNT_ID;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!appId || !secret || !site) return null;
  if (provider === "facebook" && (!configId || !accountId || !/^\d+$/.test(accountId))) return null;
  try {
    const redirect = new URL(process.env.INSTAGRAM_REDIRECT_URI || `${site.replace(/\/$/, "")}/api/instagram/callback`);
    if ((redirect.protocol !== "https:" && !(redirect.protocol === "http:" && ["localhost", "127.0.0.1"].includes(redirect.hostname))) || redirect.username || redirect.password || redirect.search || redirect.hash) return null;
    const version = process.env.INSTAGRAM_GRAPH_API_VERSION || "v25.0";
    if (!/^v\d+\.\d+$/.test(version)) return null;
    return { appId, secret, redirectUri: redirect.href, origin: redirect.origin, version, provider, configId, accountId };
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

// Check both token expiry and data-access expiry. Zero explicitly means no scheduled expiry.
export async function facebookTokenDetails(accessToken: string) {
  const config = instagramConfig("facebook");
  if (!config) throw new Error("Falta configurar la aplicación de Facebook.");
  const url = new URL(`https://graph.facebook.com/${config.version}/debug_token`);
  url.searchParams.set("input_token", accessToken);
  const { data } = await instagramJson(url, { headers: { Authorization: `Bearer ${config.appId}|${config.secret}` } });
  if (!data?.is_valid || String(data.app_id) !== config.appId || !["USER", "PAGE", "SYSTEM_USER"].includes(data.type)) throw new InstagramError("reconnect");
  const expiries = [data.expires_at, data.data_access_expires_at];
  if (expiries.some(value => !Number.isSafeInteger(value) || value < 0)) throw new InstagramError("reconnect");
  const deadlines = expiries.filter(value => value > 0);
  const expiresAt = deadlines.length ? new Date(Math.min(...deadlines) * 1000).toISOString() : null;
  if (instagramAccessExpired(expiresAt, "facebook")) throw new InstagramError("reconnect");
  return { type: data.type as "USER" | "PAGE" | "SYSTEM_USER", expires_at: expiresAt };
}

export async function exchangeInstagramCode(code: string, provider: InstagramProvider = "instagram") {
  const config = instagramConfig(provider);
  if (!config) throw new Error("Falta configurar la aplicación de Instagram.");
  if (provider === "facebook") {
    const endpoint = `https://graph.facebook.com/${config.version}/oauth/access_token`;
    const exchange = new URL(endpoint);
    exchange.search = new URLSearchParams({ client_id: config.appId, client_secret: config.secret, redirect_uri: config.redirectUri, code }).toString();
    const short = await instagramJson(exchange);
    if (typeof short.access_token !== "string") throw new InstagramError("reconnect");
    let accessToken = short.access_token as string;
    let details = await facebookTokenDetails(accessToken);
    if (details.type === "USER") {
      const long = new URL(endpoint);
      long.search = new URLSearchParams({ client_id: config.appId, client_secret: config.secret, grant_type: "fb_exchange_token", fb_exchange_token: accessToken }).toString();
      const token = await instagramJson(long);
      if (typeof token.access_token !== "string") throw new InstagramError("reconnect");
      accessToken = token.access_token;
      details = await facebookTokenDetails(accessToken);
    }
    // This store reads only its configured Instagram account, even if the user manages other pages.
    const profile = await instagramJson(`https://graph.facebook.com/${config.version}/${config.accountId}?fields=id,username`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (String(profile.id) !== config.accountId || typeof profile.username !== "string" || !instagramProfileUrl(profile.username)) throw new InstagramError("reconnect");
    return { account_id: String(profile.id), username: profile.username as string, access_token: accessToken, expires_at: details.expires_at };
  }
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
  id: boolean; connection_id: string; account_id: string; username: string; access_token: string; expires_at: string | null;
  provider: InstagramProvider;
  posts: InstagramPost[]; synced_at: string | null; checked_at: string | null; sync_lock_until: string; last_error: string | null;
};
const freshness = 15 * 60 * 1000;
const maxStale = 24 * 60 * 60 * 1000;
const emptyFeed: InstagramFeed = { username: null, posts: [] };

function publicFeed(connection: Connection): InstagramFeed {
  if (connection.last_error === "reconnect" || instagramAccessExpired(connection.expires_at, connection.provider)) return emptyFeed;
  return { username: connection.username, posts: connection.synced_at && Date.now() - Date.parse(connection.synced_at) < maxStale ? connection.posts : [] };
}

export async function loadInstagramFeed(force = false): Promise<InstagramFeed> {
  const db = instagramDatabase();
  const { data, error } = await db.from("instagram_connection").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error("No se pudo leer la conexión de Instagram.");
  if (!data) return emptyFeed;
  let connection = data as Connection;
  const config = instagramConfig(connection.provider || "instagram");
  if (!config) return emptyFeed;
  if (connection.last_error === "reconnect" || instagramAccessExpired(connection.expires_at, connection.provider)) return emptyFeed;
  if (!force && connection.checked_at && Date.now() - Date.parse(connection.checked_at) < freshness) return publicFeed(connection);
  const { data: locked, error: lockError } = await db.from("instagram_connection")
    .update({ sync_lock_until: new Date(Date.now() + 45000).toISOString(), checked_at: new Date().toISOString() })
    .eq("id", true).eq("connection_id", connection.connection_id).lt("sync_lock_until", new Date().toISOString()).select("id").maybeSingle();
  if (lockError) throw new Error("No se pudo actualizar Instagram.");
  if (!locked) return publicFeed(connection);
  try {
    // Refresh on visits, well before expiration; no background scheduler is required.
    if (config.provider === "instagram" && connection.expires_at && Date.parse(connection.expires_at) - Date.now() < 30 * 24 * 60 * 60 * 1000) {
      const refresh = new URL("https://graph.instagram.com/refresh_access_token");
      refresh.search = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: connection.access_token }).toString();
      const renewed = await instagramJson(refresh);
      if (typeof renewed.access_token !== "string" || !Number.isFinite(renewed.expires_in) || renewed.expires_in <= 0) throw new InstagramError("reconnect");
      const patch = { access_token: renewed.access_token, expires_at: new Date(Date.now() + renewed.expires_in * 1000).toISOString() };
      const { error: tokenError } = await db.from("instagram_connection").update(patch).eq("id", true).eq("connection_id", connection.connection_id);
      if (tokenError) throw new Error("No se pudo guardar la renovación.");
      connection = { ...connection, ...patch };
    }
    const host = config.provider === "facebook" ? "graph.facebook.com" : "graph.instagram.com";
    const media = new URL(`https://${host}/${config.version}/${connection.account_id}/media`);
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
