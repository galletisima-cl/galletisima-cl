export const CART_STORAGE_KEY = "galletisima_cart_count";
export const CART_UPDATED_EVENT = "galletisima-cart-updated";

export function readCartCount() {
  if (typeof window === "undefined") return 0;
  const value = Number.parseInt(window.localStorage.getItem(CART_STORAGE_KEY) || "0", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function writeCartCount(count: number) {
  const next = Math.max(0, Math.floor(count));
  window.localStorage.setItem(CART_STORAGE_KEY, String(next));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: next }));
  return next;
}
