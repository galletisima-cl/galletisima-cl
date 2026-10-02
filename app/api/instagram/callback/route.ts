import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { exchangeInstagramCode, instagramConfig, instagramDatabase, loadInstagramFeed } from "../../../../lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const config = instagramConfig();
  if (!config) return NextResponse.json({ error: "Instagram aún no está configurado." }, { status: 503 });
  const redirect = (result: string) => {
    const response = NextResponse.redirect(new URL(`/admin?instagram=${result}`, config.origin));
    response.cookies.set("instagram_oauth_state", "", { httpOnly: true, secure: config.redirectUri.startsWith("https:"), sameSite: "lax", path: "/api/instagram/callback", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const state = request.nextUrl.searchParams.get("state") || "";
  const cookie = request.cookies.get("instagram_oauth_state")?.value || "";
  if (!/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(cookie) || !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) return redirect("invalid");
  const hash = createHash("sha256").update(state).digest("hex");
  try {
    const db = instagramDatabase();
    const { data, error } = await db.from("instagram_oauth_states").select("admin_id").eq("state_hash", hash).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error || !data) return redirect("invalid");
    if (request.nextUrl.searchParams.has("error")) {
      await db.from("instagram_oauth_states").delete().eq("state_hash", hash);
      return redirect("cancelled");
    }
    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length > 4096) return redirect("invalid");
    // Confirm the initiating user still has admin access after leaving the store.
    const { data: auth, error: authError } = await db.auth.admin.getUserById(data.admin_id);
    if (authError || auth.user?.app_metadata.role !== "admin") return redirect("invalid");
    const account = await exchangeInstagramCode(code);
    const { error: saveError } = await db.rpc("finish_instagram_connection", {
      p_state_hash: hash, p_account_id: account.account_id, p_username: account.username,
      p_access_token: account.access_token, p_expires_at: account.expires_at,
    });
    if (saveError) return redirect("failed");
    await loadInstagramFeed(true).catch(() => null);
    return redirect("connected");
  } catch { return redirect("failed"); }
}
