import { NextResponse } from "next/server";
import { markOrderCancelled } from "../../../../lib/orders";

const returnKeys = ["token_ws", "TBK_TOKEN", "TBK_ORDEN_COMPRA", "TBK_ID_SESION"];

function redirectToResult(request: Request, values: FormData | URLSearchParams) {
  const destination = new URL("/pago/resultado", request.url);

  for (const key of returnKeys) {
    const value = values.get(key);
    if (typeof value === "string" && value.length <= 256) destination.searchParams.set(key, value);
  }

  return NextResponse.redirect(destination, 303);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (!params.get("token_ws")) await markOrderCancelled(params.get("TBK_ORDEN_COMPRA"));
  return redirectToResult(request, params);
}

export async function POST(request: Request) {
  const form = await request.formData();
  if (!form.get("token_ws")) await markOrderCancelled(String(form.get("TBK_ORDEN_COMPRA") || "") || null);
  return redirectToResult(request, form);
}
