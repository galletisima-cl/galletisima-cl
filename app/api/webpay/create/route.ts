import { NextResponse } from "next/server";
import { calculateCheckoutTotal, checkoutPricing } from "../../../../lib/checkout";
import { getWebpayReturnUrl, getWebpayTransaction } from "../../../../lib/webpay";
import { createPendingOrder, getNextOrderNumber, type Buyer } from "../../../../lib/orders";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const buyer = validateBuyer(body?.buyer);
    const checkout = await calculateCheckoutTotal(body?.items, buyer.communeId, body?.couponCode);
    const { subtotal, shipping, shippingOption, total, lines, discountAmount, shippingDiscount, appliedDiscounts } = checkout;
    if (!Number.isSafeInteger(body?.expectedTotal) || body.expectedTotal !== total) {
      return NextResponse.json({ error: "El total de tu compra cambió. Revisa el nuevo importe y vuelve a continuar.", pricing: checkoutPricing(checkout) }, { status: 409 });
    }
    const identifier = crypto.randomUUID().replaceAll("-", "");
    const buyOrder = await getNextOrderNumber();
    const sessionId = identifier;
    const response = await getWebpayTransaction().create(
      buyOrder,
      sessionId,
      total,
      getWebpayReturnUrl(request.url),
    );

    await createPendingOrder({ buyOrder, sessionId, token: response.token, subtotal, shipping, shippingOption, total, buyer, lines, discountAmount, shippingDiscount, appliedDiscounts });

    return NextResponse.json({ url: response.url, token: response.token });
  } catch (error) {
    console.error("No se pudo crear la transacción Webpay", error);
    const message = error instanceof Error ? error.message : "No pudimos iniciar el pago.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function validateBuyer(input: unknown): Buyer {
  const value = (input || {}) as Partial<Buyer>;
  const name = String(value.name || "").trim().slice(0, 120);
  const email = String(value.email || "").trim().toLowerCase().slice(0, 254);
  const phone = String(value.phone || "").trim().slice(0, 30);
  const communeId = String(value.communeId || "").trim().slice(0, 5);
  const address = String(value.address || "").trim().slice(0, 180);
  const addressExtra = String(value.addressExtra || "").trim().slice(0, 120);
  if (name.length < 2) throw new Error("Ingresa tu nombre para continuar.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ingresa un correo electrónico válido.");
  if (phone && !/^[+\d\s()-]{7,30}$/.test(phone)) throw new Error("Ingresa un teléfono válido.");
  if (!/^\d{5}$/.test(communeId)) throw new Error("Selecciona una comuna de despacho.");
  if (address.length < 5) throw new Error("Ingresa una dirección de despacho válida.");
  return { name, email, phone, communeId, address, addressExtra };
}
