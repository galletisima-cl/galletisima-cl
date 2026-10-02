export type InstagramPost = {
  id: string; caption: string; imageUrl: string | null; permalink: string;
  type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM"; timestamp: string;
};
export type InstagramFeed = { username: string | null; posts: InstagramPost[] };

export function instagramProfileUrl(username: string) {
  return /^[a-zA-Z0-9._]{1,30}$/.test(username) ? `https://www.instagram.com/${username}/` : null;
}

export function safeInstagramProfile(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname) || url.username || url.password) return null;
    const name = url.pathname.split("/").filter(Boolean);
    return name.length === 1 && !["p", "reel", "reels", "stories", "explore"].includes(name[0]) ? instagramProfileUrl(name[0]) : null;
  } catch { return null; }
}
