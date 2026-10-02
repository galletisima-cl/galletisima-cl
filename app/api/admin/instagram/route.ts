import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { instagramAdmin, instagramConfig, loadInstagramFeed } from "../../../../lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 60;
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const auth = await instagramAdmin(request);
    if (!auth) return NextResponse.json({ error: "Inicia sesión como administrador." }, { status: 401, headers: noStore });
    const config = instagramConfig();
    const { data, error } = await auth.db.from("instagram_connection").select("username,expires_at,synced_at,last_error").eq("id", true).maybeSingle();
    return NextResponse.json({ configured: !!config, storageReady: !error, connection: error ? null : data, needsReconnect: !!data && (data.last_error === "reconnect" || Date.parse(data.expires_at) <= Date.now()) }, { headers: noStore });
  } catch { return NextResponse.json({ error: "No se pudo consultar la conexión." }, { status: 500, headers: noStore }); }
}

export async function POST(request: Request) {
  try {
    const auth = await instagramAdmin(request);
    if (!auth) return NextResponse.json({ error: "Inicia sesión como administrador." }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (body?.action === "disconnect") {
      const { error } = await auth.db.rpc("disconnect_instagram");
      if (error) throw new Error("Disconnect failed");
      return NextResponse.json({ disconnected: true }, { headers: noStore });
    }
    const config = instagramConfig();
    if (!config) return NextResponse.json({ error: "Falta configurar la aplicación de Meta en el servidor." }, { status: 503 });
    if (body?.action === "sync") {
      await loadInstagramFeed(true);
      return NextResponse.json({ refreshed: true }, { headers: noStore });
    }
    if (body?.action !== "connect") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    const state = randomBytes(32).toString("hex");
    const stateHash = createHash("sha256").update(state).digest("hex");
    await auth.db.from("instagram_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const { error } = await auth.db.from("instagram_oauth_states").insert({ state_hash: stateHash, admin_id: auth.userId, expires_at: new Date(Date.now() + 600000).toISOString() });
    if (error) return NextResponse.json({ error: "Falta preparar la conexión de Instagram en la base de datos." }, { status: 503 });
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.search = new URLSearchParams({ client_id: config.appId, redirect_uri: config.redirectUri, response_type: "code", scope: "instagram_business_basic", state, enable_fb_login: "0", force_authentication: "1" }).toString();
    const response = NextResponse.json({ url: url.href }, { headers: noStore });
    response.cookies.set("instagram_oauth_state", state, { httpOnly: true, secure: config.redirectUri.startsWith("https:"), sameSite: "lax", path: "/api/instagram/callback", maxAge: 600 });
    return response;
  } catch { return NextResponse.json({ error: "No pudimos completar la conexión. Inténtalo nuevamente." }, { status: 500, headers: noStore }); }
}
