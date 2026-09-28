import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function adminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderNumber = String(body?.orderNumber || "").replace(/\D/g, "").slice(0, 14);
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 254);
    if (!/^\d{11,}$/.test(orderNumber) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Revisa el número de pedido y el correo." }, { status: 400 });
    }
    const { data, error } = await adminSupabase().from("orders")
      .select("public_order_number,status,payment_status,total,shipping_commune,created_at,paid_at")
      .eq("public_order_number", orderNumber).eq("buyer_email", email).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No encontramos un pedido con esos datos." }, { status: 404 });
    return NextResponse.json({ order: data });
  } catch (error) {
    console.error("No se pudo consultar el seguimiento", error);
    return NextResponse.json({ error: "No pudimos consultar el pedido en este momento." }, { status: 500 });
  }
}
