"use client";

import { createClient } from "./supabase/client";

// Registro de vistas y búsquedas, y puntaje para ordenar el catálogo completo:
// 1) más vendidos, 2) más vistos, 3) más buscados, 4) más nuevos.

export type ProductPopularity = { sales: number; views: number; searches: number };
export type PopularityMap = Record<string, ProductPopularity>;

const VIEW_KEY_PREFIX = "galletisima:vista:";
let lastSearch = "";

// Una vista por producto y por sesión del navegador, para que recargar la
// página no infle el conteo.
export function trackProductView(productId: string) {
  try {
    const key = VIEW_KEY_PREFIX + productId;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Sin sessionStorage (modo privado estricto): se registra igual.
  }
  void createClient().rpc("track_product_view", { p_product_id: productId }).then(() => undefined, () => undefined);
}

export function trackSearch(term: string, source: string) {
  const clean = term.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 100);
  if (clean.length < 2 || clean === lastSearch) return;
  lastSearch = clean;
  void createClient().rpc("track_search", { p_term: clean, p_source: source }).then(() => undefined, () => undefined);
}

// Si la función aún no existe en la base, devuelve un mapa vacío y el
// catálogo queda ordenado solo por los más nuevos.
export async function loadPopularity(): Promise<PopularityMap> {
  const { data, error } = await createClient().rpc("product_catalog_ranking");
  if (error || !Array.isArray(data)) return {};
  return Object.fromEntries(
    (data as { product_id: string; sales: number; views: number; searches: number }[]).map((row) => [
      row.product_id,
      { sales: Number(row.sales) || 0, views: Number(row.views) || 0, searches: Number(row.searches) || 0 },
    ]),
  );
}

export function comparePopularity(
  a: { id: string; name: string; created_at?: string | null },
  b: { id: string; name: string; created_at?: string | null },
  popularity: PopularityMap,
) {
  const pa = popularity[a.id];
  const pb = popularity[b.id];
  return (
    (pb?.sales ?? 0) - (pa?.sales ?? 0) ||
    (pb?.views ?? 0) - (pa?.views ?? 0) ||
    (pb?.searches ?? 0) - (pa?.searches ?? 0) ||
    (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0) ||
    a.name.localeCompare(b.name, "es")
  );
}
