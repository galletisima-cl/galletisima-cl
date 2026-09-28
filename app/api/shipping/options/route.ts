import { NextResponse } from "next/server";
import { getShippingOptions } from "../../../../lib/shipping";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ options: await getShippingOptions() });
  } catch (error) {
    console.error("No se pudieron cargar las tarifas de envío", error);
    return NextResponse.json({ error: "No pudimos cargar las comunas y tarifas." }, { status: 500 });
  }
}

