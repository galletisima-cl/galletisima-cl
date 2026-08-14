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
};

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
  const existing = items.find((candidate) => candidate.productId === item.productId && candidate.size === item.size);
  if (existing) existing.quantity += item.quantity;
  else items.push({ ...item, quantity: Math.max(1, item.quantity) });
  return saveCart(items);
}

export function updateCartQuantity(productId: string, size: string, quantity: number) {
  const items = readCartItems().map((item) => item.productId === productId && item.size === size ? { ...item, quantity: Math.max(0, quantity) } : item).filter((item) => item.quantity > 0);
  return saveCart(items);
}

export function removeCartItem(productId: string, size: string) {
  return saveCart(readCartItems().filter((item) => item.productId !== productId || item.size !== size));
}

export function clearCart() { return saveCart([]); }
