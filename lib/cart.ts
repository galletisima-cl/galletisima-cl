import { MANGUITO_PRICE } from "./manguito";

export const CART_STORAGE_KEY = "galletisima_cart";
export const CART_UPDATED_EVENT = "galletisima-cart-updated";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  size: string;
  price: number;
  imageUrl: string;
  quantity: number;
  manguito?: boolean;
};

// Precio de una unidad: base + $200 si lleva manguito.
export function cartUnitPrice(item: Pick<CartItem, "price" | "manguito">) {
  return item.price + (item.manguito ? MANGUITO_PRICE : 0);
}

function sameLine(a: Pick<CartItem, "productId" | "size" | "manguito">, b: Pick<CartItem, "productId" | "size" | "manguito">) {
  return a.productId === b.productId && a.size === b.size && Boolean(a.manguito) === Boolean(b.manguito);
}

export function readCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.productId && item?.quantity > 0) : [];
  } catch {
    return [];
  }
}

export function readCartCount() {
  return readCartItems().reduce((total, item) => total + item.quantity, 0);
}

function saveCart(items: CartItem[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: readCartCount() }));
  return items;
}

export function addCartItem(item: CartItem) {
  const items = readCartItems();
  const existing = items.find((candidate) => sameLine(candidate, item));
  if (existing) existing.quantity += item.quantity;
  else items.push({ ...item, quantity: Math.max(1, item.quantity) });
  return saveCart(items);
}

export function updateCartQuantity(productId: string, size: string, quantity: number, manguito = false) {
  const items = readCartItems().map((item) => sameLine(item, { productId, size, manguito }) ? { ...item, quantity: Math.max(0, quantity) } : item).filter((item) => item.quantity > 0);
  return saveCart(items);
}

export function removeCartItem(productId: string, size: string, manguito = false) {
  return saveCart(readCartItems().filter((item) => !sameLine(item, { productId, size, manguito })));
}

// Agrega o quita el manguito de todas las líneas del carrito, fusionando líneas iguales.
export function setManguitoForAll(enabled: boolean) {
  const merged: CartItem[] = [];
  for (const item of readCartItems()) {
    const next = { ...item, manguito: enabled };
    const existing = merged.find((candidate) => sameLine(candidate, next));
    if (existing) existing.quantity += next.quantity;
    else merged.push(next);
  }
  return saveCart(merged);
}

export function clearCart() { return saveCart([]); }
