export const DISCOUNTS_SETTING_KEY = "automatic_discounts";
export const MAX_DISCOUNT_RULES = 100;

export type DiscountKind = "free_shipping" | "order" | "product" | "minimum_order";
export type DiscountRule = {
  id: string;
  name: string;
  kind: DiscountKind;
  active: boolean;
  valueType: "fixed" | "percentage";
  value: number;
  minSubtotal: number;
  productId: string | null;
  code: string | null;
};
export type AppliedDiscount = {
  id: string;
  name: string;
  kind: DiscountKind;
  amount: number;
  productId: string | null;
  code?: string;
};
export type CheckoutPricing = {
  subtotal: number;
  shipping: number;
  shippingDiscount: number;
  discountAmount: number;
  total: number;
  appliedDiscounts: AppliedDiscount[];
  coupon?: { code: string; applied: boolean };
};
type PricedLine = { productId: string; unitPrice: number; quantity: number };

export function normalizeCouponCode(input: unknown): string {
  if (input === undefined || input === null || input === "") return "";
  if (typeof input !== "string") throw new Error("El código de descuento no es válido.");
  const code = input.trim().toUpperCase();
  if (code && !/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error("Usa un código de 3 a 40 letras, números, guiones o guiones bajos.");
  return code;
}

export function validateDiscountRule(input: unknown): DiscountRule {
  if (!input || typeof input !== "object") throw new Error("El descuento no es válido.");
  const rule = input as Partial<DiscountRule>;
  if (typeof rule.id !== "string" || !/^[a-zA-Z0-9-]{1,64}$/.test(rule.id)) throw new Error("El identificador del descuento no es válido.");
  if (typeof rule.name !== "string" || !rule.name.trim() || rule.name.trim().length > 80) throw new Error("Ingresa un nombre de hasta 80 caracteres.");
  if (!["free_shipping", "order", "product", "minimum_order"].includes(rule.kind || "")) throw new Error("Selecciona un tipo de descuento válido.");
  if (typeof rule.active !== "boolean") throw new Error("El estado del descuento no es válido.");
  if (!Number.isSafeInteger(rule.minSubtotal) || Number(rule.minSubtotal) < 0) throw new Error("El monto mínimo debe ser un número entero igual o mayor a cero.");
  if (rule.kind === "minimum_order" && !rule.minSubtotal) throw new Error("Ingresa el monto mínimo de compra para este descuento.");
  if (rule.kind !== "free_shipping") {
    if (rule.valueType !== "fixed" && rule.valueType !== "percentage") throw new Error("Selecciona monto fijo o porcentaje.");
    if (!Number.isSafeInteger(rule.value) || Number(rule.value) <= 0 || Number(rule.value) > (rule.valueType === "percentage" ? 100 : 1_000_000_000)) throw new Error("Ingresa un descuento válido: monto entero positivo o porcentaje entre 1 y 100.");
  }
  if (rule.kind === "product" && (typeof rule.productId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rule.productId))) throw new Error("Selecciona el producto al que se aplicará el descuento.");
  return {
    id: rule.id, name: rule.name.trim(), kind: rule.kind as DiscountKind, active: rule.active,
    minSubtotal: Number(rule.minSubtotal), productId: rule.kind === "product" ? rule.productId! : null,
    valueType: rule.kind === "free_shipping" ? "fixed" : rule.valueType!,
    value: rule.kind === "free_shipping" ? 0 : Number(rule.value),
    code: normalizeCouponCode(rule.code) || null,
  };
}

export function parseDiscountRules(value: string | null | undefined): DiscountRule[] {
  if (!value) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("La configuración de descuentos no es válida."); }
  if (!Array.isArray(parsed) || parsed.length > MAX_DISCOUNT_RULES) throw new Error("La configuración de descuentos no es válida.");
  const rules = parsed.map(validateDiscountRule);
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length) throw new Error("Hay identificadores de descuentos duplicados.");
  const codes = rules.flatMap((rule) => rule.code ? [rule.code] : []);
  if (new Set(codes).size !== codes.length) throw new Error("Ya existe un descuento con ese código. Usa un código diferente.");
  return rules;
}

function amountOff(base: number, rule: DiscountRule) {
  return Math.min(base, rule.valueType === "percentage" ? Math.floor(base * rule.value / 100) : rule.value);
}

// Choose the best merchandise offer; free shipping can be combined with it.
// Product discounts are rounded per unit so splitting cart rows cannot increase savings.
export function applyDiscounts(lines: PricedLine[], shippingPrice: number, rules: DiscountRule[], couponInput?: unknown): CheckoutPricing {
  if (!Number.isSafeInteger(shippingPrice) || shippingPrice < 0 || lines.some((line) => !Number.isSafeInteger(line.unitPrice) || line.unitPrice <= 0 || !Number.isSafeInteger(line.quantity) || line.quantity <= 0)) throw new Error("Los montos de la compra no son válidos.");
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(subtotal + shippingPrice)) throw new Error("El monto de la compra no es válido.");
  const code = normalizeCouponCode(couponInput);
  const couponRule = code ? rules.find((rule) => rule.active && rule.code === code) : undefined;
  if (code && !couponRule) throw new Error("El cupón no existe o ya no está activo. Revisa el código.");
  if (couponRule && subtotal < couponRule.minSubtotal) throw new Error(`Este cupón requiere al menos ${new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(couponRule.minSubtotal)} en productos.`);
  if (couponRule?.kind === "product" && !lines.some((line) => line.productId === couponRule.productId)) throw new Error("Este cupón no corresponde a los productos de tu carrito.");
  const eligible = rules.filter((rule) => rule.active && subtotal >= rule.minSubtotal && (!rule.code || rule.code === code));
  const productDiscounts = new Map<string, AppliedDiscount>();
  for (const line of lines) {
    let best: DiscountRule | undefined;
    let amount = 0;
    for (const rule of eligible) {
      if (rule.kind !== "product" || rule.productId !== line.productId) continue;
      const candidate = amountOff(line.unitPrice, rule) * line.quantity;
      if (candidate > amount) { best = rule; amount = candidate; }
    }
    if (best) productDiscounts.set(best.id, { id: best.id, name: best.name, kind: best.kind, productId: best.productId, amount: amount + (productDiscounts.get(best.id)?.amount || 0), ...(best.code ? { code: best.code } : {}) });
  }
  let appliedDiscounts = [...productDiscounts.values()];
  let discountAmount = appliedDiscounts.reduce((sum, discount) => sum + discount.amount, 0);
  for (const rule of eligible) {
    if (rule.kind !== "order" && rule.kind !== "minimum_order") continue;
    const amount = amountOff(subtotal, rule);
    if (amount > discountAmount) {
      discountAmount = amount;
      appliedDiscounts = [{ id: rule.id, name: rule.name, kind: rule.kind, productId: null, amount, ...(rule.code ? { code: rule.code } : {}) }];
    }
  }
  const freeShipping = eligible.find((rule) => rule.kind === "free_shipping");
  const shippingDiscount = freeShipping ? shippingPrice : 0;
  if (freeShipping && shippingDiscount > 0) appliedDiscounts.push({ id: freeShipping.id, name: freeShipping.name, kind: freeShipping.kind, productId: null, amount: shippingDiscount, ...(freeShipping.code ? { code: freeShipping.code } : {}) });
  const shipping = shippingPrice - shippingDiscount;
  return { subtotal, shipping, shippingDiscount, discountAmount, total: subtotal - discountAmount + shipping, appliedDiscounts, ...(code ? { coupon: { code, applied: appliedDiscounts.some((discount) => discount.id === couponRule?.id) } } : {}) };
}
