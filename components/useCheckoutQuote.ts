"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartItem } from "../lib/cart";
import type { CheckoutPricing } from "../lib/discounts";
import type { ShippingOption } from "../lib/shipping";

export function useCheckoutQuote(items: CartItem[], enabled: boolean) {
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingError, setShippingError] = useState("");
  const [regionId, setRegionId] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [quoteState, setQuoteState] = useState<{ key: string; pricing?: CheckoutPricing; error?: string } | null>(null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const quoteKey = JSON.stringify({ items: items.map(({ productId, size, quantity }) => ({ productId, size, quantity })), communeId, couponCode });
  const currentQuote = quoteState?.key === quoteKey ? quoteState : null;
  const selectedShipping = shippingOptions.find((option) => option.communeId === communeId);
  const regions = useMemo(() => [...new Map(shippingOptions.map((option) => [option.regionId, option.region])).entries()], [shippingOptions]);
  const communeOptions = shippingOptions.filter((option) => option.regionId === regionId && option.active);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetch("/api/shipping/options", { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos cargar las comunas.");
      if (!controller.signal.aborted) setShippingOptions(data.options || []);
    }).catch((caught) => {
      if (!controller.signal.aborted) setShippingError(caught instanceof Error ? caught.message : "No pudimos cargar las comunas.");
    });
    return () => controller.abort();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !communeId) return;
    const controller = new AbortController();
    void fetch("/api/checkout/quote", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: quoteKey, signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.pricing) throw new Error(data.error || "No pudimos calcular tu compra.");
      if (!controller.signal.aborted) setQuoteState({ key: quoteKey, pricing: data.pricing });
    }).catch((caught) => {
      if (!controller.signal.aborted) setQuoteState({ key: quoteKey, error: caught instanceof Error ? caught.message : "No pudimos calcular tu compra." });
    });
    return () => controller.abort();
  }, [enabled, communeId, quoteKey, quoteAttempt]);

  return {
    regionId, communeId, regions, communeOptions, selectedShipping, shippingError, couponCode,
    pricing: currentQuote?.pricing, quoteError: currentQuote?.error,
    isQuoting: Boolean(communeId) && !currentQuote,
    selectRegion: (id: string) => { setRegionId(id); setCommuneId(""); },
    selectCommune: setCommuneId,
    applyCoupon: (code: string) => { setCouponCode(code.trim().toUpperCase()); setQuoteState(null); setQuoteAttempt((value) => value + 1); },
    removeCoupon: () => setCouponCode(""),
    updatePricing: (pricing: CheckoutPricing) => setQuoteState({ key: quoteKey, pricing }),
    retry: () => { setQuoteState(null); setQuoteAttempt((value) => value + 1); },
  };
}

export type CheckoutQuote = ReturnType<typeof useCheckoutQuote>;
