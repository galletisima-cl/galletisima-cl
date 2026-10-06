"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { shouldTrackMetaPixel, trackMetaPageView } from "../lib/meta-pixel";

export default function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = `${pathname}?${searchParams.toString()}`;
  const lastPage = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldTrackMetaPixel(window.location.hostname, pathname)) {
      lastPage.current = null;
      return;
    }
    if (lastPage.current === page) return;
    trackMetaPageView();
    lastPage.current = page;
  }, [pathname, page]);

  return null;
}
