// Miniaturas con las transformaciones de imagen de Supabase Storage (plan Pro).
// Solo se activa con NEXT_PUBLIC_IMAGE_TRANSFORM=true; si no, devuelve la URL original.
const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";

export function thumbUrl(url: string | null | undefined, width: number, quality = 70): string {
  if (!url) return "";
  if (process.env.NEXT_PUBLIC_IMAGE_TRANSFORM !== "true") return url;
  if (!url.includes(OBJECT_PATH) || url.includes("?")) return url;
  return `${url.replace(OBJECT_PATH, RENDER_PATH)}?width=${width}&quality=${quality}`;
}
