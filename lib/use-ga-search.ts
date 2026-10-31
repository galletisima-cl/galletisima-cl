"use client";

import { useEffect } from "react";
import { trackGaSearch } from "./analytics";
import { trackSearch } from "./popularity";

// Envía a Google Analytics lo que la persona buscó, una vez que deja de escribir
// por un segundo, para no registrar cada letra.
export function useGaSearch(term: string, source: string) {
  useEffect(() => {
    if (term.trim().length < 2) return;
    const timer = window.setTimeout(() => { trackGaSearch(term, source); trackSearch(term, source); }, 1000);
    return () => window.clearTimeout(timer);
  }, [term, source]);
}
