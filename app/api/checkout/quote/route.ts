import { NextResponse } from "next/server";
import { calculateCheckoutTotal, checkoutPricing } from "../../../../lib/checkout";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body?.communeId !== "string" || !/^\d{5}$/.test(body.communeId)) throw new Error("Selecciona una comuna de despacho.");
    const checkout = await calculateCheckoutTotal(body?.items, body.communeId, body?.couponCode);
    return NextResponse.json({ pricing: checkoutPricing(checkout) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No pudimos calcular tu compra." }, { status: 400 });
  }
}
