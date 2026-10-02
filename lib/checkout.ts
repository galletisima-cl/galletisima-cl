import { createClient } from "@supabase/supabase-js";
import { calculateShipping } from "./shipping";
import { applyDiscounts, DISCOUNTS_SETTING_KEY, parseDiscountRules, type CheckoutPricing } from "./discounts";

export type CheckoutItem = {
  productId: string;
  size: string;
  quantity: number;
};

export type CheckoutLine = CheckoutItem & { name: string; unitPrice: number; lineTotal: number };

function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function calculateCheckoutTotal(input: unknown, communeId: string, couponCode?: unknown) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 50) {
    throw new Error("El carrito no contiene productos válidos.");
  }

  const items: CheckoutItem[] = input.map((candidate) => {
    if (!candidate || typeof candidate !== "object") throw new Error("Uno de los productos del carrito no es válido.");
    const item = candidate as Partial<CheckoutItem>;
    const quantity = Number(item.quantity);
    if (!item.productId || typeof item.productId !== "string" || typeof item.size !== "string" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error("Uno de los productos del carrito no es válido.");
    }
    return { productId: item.productId, size: item.size, quantity };
  });

  const productIds = [...new Set(items.map((item) => item.productId))];
  const supabase = serverSupabase();
  const [{ data: products, error: productsError }, { data: settings, error: settingError }] = await Promise.all([
    supabase.from("products").select("id,name,price,size,active").in("id", productIds).eq("active", true),
    supabase.from("site_settings").select("key,value").in("key", ["product_size_prices", DISCOUNTS_SETTING_KEY]),
  ]);

  if (productsError || settingError) throw new Error("No pudimos verificar los precios del carrito.");
  if (!products || products.length !== productIds.length) throw new Error("Uno de los productos ya no está disponible.");

  let sizePrices: Record<string, Record<string, number>> = {};
  try { sizePrices = JSON.parse(settings?.find((setting) => setting.key === "product_size_prices")?.value || "{}"); } catch { sizePrices = {}; }
  const discounts = parseDiscountRules(settings?.find((setting) => setting.key === DISCOUNTS_SETTING_KEY)?.value);
  const productsById = new Map(products.map((product) => [String(product.id), product]));

  const lines: CheckoutLine[] = items.map((item) => {
    const product = productsById.get(item.productId);
    if (!product) throw new Error("Uno de los productos ya no está disponible.");
    const allowedSizes = String(product.size || "").split(/[,;\n]+/).map((size) => size.trim()).filter(Boolean);
    if (allowedSizes.length && !allowedSizes.includes(item.size)) throw new Error("La medida seleccionada ya no está disponible.");
    const configuredPrice = Number(sizePrices[item.productId]?.[item.size]);
    const unitPrice = configuredPrice > 0 ? configuredPrice : Number(product.price);
    if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) throw new Error("Uno de los productos no tiene un precio válido.");
    return { ...item, name: String(product.name), unitPrice, lineTotal: unitPrice * item.quantity };
  });
  const shippingOption = await calculateShipping(communeId);
  const pricing = applyDiscounts(lines, shippingOption.price, discounts, couponCode);

  if (!Number.isSafeInteger(pricing.total) || pricing.total <= 0) throw new Error("El total debe ser mayor a $0 para pagar con Webpay.");
  return { ...pricing, shippingOption, items, lines };
}

export function checkoutPricing(checkout: CheckoutPricing): CheckoutPricing {
  const { subtotal, shipping, shippingDiscount, discountAmount, total, appliedDiscounts, coupon } = checkout;
  return { subtotal, shipping, shippingDiscount, discountAmount, total, appliedDiscounts, ...(coupon ? { coupon } : {}) };
}
