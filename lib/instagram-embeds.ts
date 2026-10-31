// Publicaciones de Instagram elegidas a mano desde el admin y mostradas con la
// inserción oficial de Instagram (sin token ni app de Meta).

export const INSTAGRAM_EMBEDS_SETTING_KEY = "instagram_embed_urls";
export const MAX_INSTAGRAM_EMBEDS = 8;

const POST_PATTERN = /^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})\/?$/;

// Devuelve el enlace limpio (https://www.instagram.com/p/CODIGO/) o null si no
// es una publicación de Instagram. Quita parámetros como ?igsh=… o ?utm_source=….
export function normalizeInstagramPostUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (host !== "instagram.com" && host !== "www.instagram.com" && host !== "m.instagram.com") return null;
  const match = url.pathname.match(POST_PATTERN);
  if (!match) return null;
  const kind = match[1] === "reels" ? "reel" : match[1];
  return `https://www.instagram.com/${kind}/${match[2]}/`;
}

// Separa el texto del admin (una por línea, o separadas por espacios/comas) en
// enlaces válidos sin repetir y líneas que no se pudieron leer.
export function parseInstagramEmbedInput(text: string) {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const piece of text.split(/[\s,]+/)) {
    if (!piece) continue;
    const normalized = normalizeInstagramPostUrl(piece);
    if (!normalized) invalid.push(piece);
    else if (!valid.includes(normalized)) valid.push(normalized);
  }
  return { valid: valid.slice(0, MAX_INSTAGRAM_EMBEDS), invalid, overLimit: valid.length > MAX_INSTAGRAM_EMBEDS };
}

export function readInstagramEmbedSetting(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parseInstagramEmbedInput(parsed.filter((item): item is string => typeof item === "string").join("\n")).valid;
  } catch {
    return [];
  }
}
