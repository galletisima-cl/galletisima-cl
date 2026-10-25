"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackGaPageView, trackGaSearch } from "../lib/analytics";

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef<string | null>(null);
  const searchFromUrl = searchParams.get("buscar") || "";

  // Una vista de página por cada cambio de ruta (no por cada cambio de filtros).
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackGaPageView();
  }, [pathname]);

  // Búsquedas del encabezado y de los accesos del menú (/?buscar=...).
  useEffect(() => {
    if (searchFromUrl) trackGaSearch(searchFromUrl, "encabezado");
  }, [searchFromUrl]);

  return null;
}
