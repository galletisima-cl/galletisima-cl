import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createHash } from "node:crypto";
import { register } from "node:module";
import { NextRequest } from "next/server.js";
register("./helpers/typescript-resolver.mjs", import.meta.url);
process.env.SUPABASE_URL = "https://instagram-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
process.env.NEXT_PUBLIC_SITE_URL = "https://store.example.com";
process.env.INSTAGRAM_APP_SECRET = "test-app-secret";
process.env.INSTAGRAM_REDIRECT_URI = "https://store.example.com/api/instagram/callback";
const adminId = "00000000-0000-4000-8000-000000000001";
const future = () => new Date(Date.now() + 60 * 86400000).toISOString();
const rawPost = { id: "post1", caption: "Nuevos moldes <prueba>", media_type: "IMAGE", media_url: "https://scontent.cdninstagram.com/photo.jpg", permalink: "https://www.instagram.com/p/Test123/", timestamp: "2026-10-01T12:00:00Z" };
let role, connection, state, calls, media, graphError, storageFailure;
const originalFetch = globalThis.fetch;
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url || input.toString());
  assert.ok(["instagram-test.supabase.co", "graph.instagram.com", "api.instagram.com"].includes(url.hostname), "Unexpected test host; no real network access allowed");
  const method = init?.method || "GET";
  const body = init?.body instanceof FormData ? Object.fromEntries(init.body) : init?.body ? JSON.parse(init.body) : null;
  calls.push({ url, method, body, headers: new Headers(init?.headers) });
  if (url.hostname === "api.instagram.com") return reply({ access_token: "test-short-token", user_id: "123" });
  if (url.hostname === "graph.instagram.com") {
    if (graphError) return reply({ error: { code: graphError } }, graphError === 190 ? 401 : 503);
    if (url.pathname === "/access_token" || url.pathname === "/refresh_access_token") return reply({ access_token: "test-long-token", expires_in: 5184000 });
    if (url.pathname.endsWith("/me")) return reply({ user_id: "123", username: "galletisimacl" });
    if (url.pathname.endsWith("/media")) return reply({ data: media });
  }
  if (url.pathname.startsWith("/auth/v1/")) return reply({ id: adminId, app_metadata: { role } });
  if (url.pathname === "/rest/v1/instagram_oauth_states") {
    if (method === "POST") { state = body; return reply(null); }
    if (method === "DELETE") {
      if (url.searchParams.has("state_hash")) state = null;
      return reply(null);
    }
    return reply(state && url.searchParams.get("state_hash") === `eq.${state.state_hash}` && Date.parse(state.expires_at) > Date.now() ? { admin_id: state.admin_id } : null);
  }
  if (url.pathname === "/rest/v1/instagram_connection") {
    if (storageFailure) return reply({ message: "test storage unavailable" }, 500);
    if (method === "PATCH") {
      if (!connection || (url.searchParams.has("sync_lock_until") && Date.parse(connection.sync_lock_until) >= Date.now())) return reply(null);
      Object.assign(connection, body);
    }
    const select = url.searchParams.get("select");
    return reply(connection && select && select !== "*" ? Object.fromEntries(select.split(",").map(key => [key, connection[key]])) : connection);
  }
  if (url.pathname === "/rest/v1/rpc/finish_instagram_connection") {
    if (!state || state.state_hash !== body.p_state_hash) return reply({ message: "Invalid state" }, 400);
    state = null;
    connection = { id: true, connection_id: "new-connection", account_id: body.p_account_id, username: body.p_username, access_token: body.p_access_token, expires_at: body.p_expires_at, posts: [], synced_at: null, checked_at: null, sync_lock_until: new Date(0).toISOString(), last_error: null };
    return reply(null);
  }
  if (url.pathname === "/rest/v1/rpc/disconnect_instagram") { state = null; connection = null; return reply(null); }
  throw new Error(`Unexpected test request ${method} ${url}`);
};
beforeEach(() => {
  role = "admin"; connection = null; state = null; calls = []; media = [structuredClone(rawPost)]; graphError = null; storageFailure = false;
  process.env.INSTAGRAM_APP_ID = "test-app";
});
after(() => { globalThis.fetch = originalFetch; });
const { POST: adminPost, GET: adminGet } = await import("../app/api/admin/instagram/route.ts");
const { GET: callback } = await import("../app/api/instagram/callback/route.ts");
const { GET: feedGet } = await import("../app/api/instagram/feed/route.ts");
const { normalizeInstagramPosts, loadInstagramFeed } = await import("../lib/instagram.ts");
const adminRequest = (action, authorized = true) => new Request("https://store.example.com/api/admin/instagram", { method: action ? "POST" : "GET", headers: { ...(authorized ? { Authorization: "Bearer test-token" } : {}), "Content-Type": "application/json" }, ...(action ? { body: JSON.stringify({ action }) } : {}) });
const seedConnection = () => connection = { id: true, connection_id: "test-connection", account_id: "123", username: "galletisimacl", access_token: "private-test-token", expires_at: future(), posts: [], synced_at: null, checked_at: null, sync_lock_until: new Date(0).toISOString(), last_error: null };

test("only admins can connect, synchronize or disconnect", async () => {
  assert.equal((await adminPost(adminRequest("connect", false))).status, 401);
  role = "customer";
  for (const action of ["connect", "sync", "disconnect"]) assert.equal((await adminPost(adminRequest(action))).status, 401);
  assert.ok(calls.every(call => call.url.pathname.startsWith("/auth/")));
});
test("connect uses minimum permission and an expiring browser-bound state", async () => {
  const response = await adminPost(adminRequest("connect"));
  const { url } = await response.json();
  const login = new URL(url);
  assert.equal(login.hostname, "www.instagram.com");
  assert.equal(login.searchParams.get("scope"), "instagram_business_basic");
  assert.equal(state.state_hash, createHash("sha256").update(login.searchParams.get("state")).digest("hex"));
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=lax/i);
  assert.match(response.headers.get("set-cookie"), /Secure/);
  assert.ok(!url.includes("secret"));
});
test("invalid state and missing browser cookie cannot exchange a token", async () => {
  const request = new NextRequest(`https://store.example.com/api/instagram/callback?code=test&state=${"a".repeat(64)}`);
  assert.match((await callback(request)).headers.get("location"), /instagram=invalid/);
  assert.equal(calls.length, 0);
});
test("callback stores credentials privately, loads photos and consumes state", async () => {
  const { url } = await (await adminPost(adminRequest("connect"))).json();
  const nonce = new URL(url).searchParams.get("state");
  const request = new NextRequest(`https://store.example.com/api/instagram/callback?code=test-code&state=${nonce}`, { headers: { Cookie: `instagram_oauth_state=${nonce}` } });
  const response = await callback(request);
  assert.match(response.headers.get("location"), /instagram=connected/);
  assert.equal(connection.access_token, "test-long-token");
  assert.equal(connection.posts.length, 1);
  assert.equal(state, null);
  const publicData = await (await feedGet()).text();
  assert.ok(publicData.includes("galletisimacl"));
  assert.ok(!publicData.includes("access_token") && !publicData.includes("test-long-token"));
  assert.match((await callback(request)).headers.get("location"), /instagram=invalid/);
});
test("expired authorization and revoked admin role are rejected", async () => {
  const nonce = "a".repeat(64);
  state = { state_hash: createHash("sha256").update(nonce).digest("hex"), admin_id: adminId, expires_at: new Date(0).toISOString() };
  const request = new NextRequest(`https://store.example.com/api/instagram/callback?code=test-code&state=${nonce}`, { headers: { Cookie: `instagram_oauth_state=${nonce}` } });
  assert.match((await callback(request)).headers.get("location"), /instagram=invalid/);
  state.expires_at = future(); role = "customer";
  assert.match((await callback(request)).headers.get("location"), /instagram=invalid/);
  assert.equal(calls.filter(call => call.url.hostname === "api.instagram.com").length, 0);
});
test("cached posts avoid repeated provider calls and admin status hides credentials", async () => {
  seedConnection();
  await loadInstagramFeed();
  await loadInstagramFeed();
  assert.equal(calls.filter(call => call.url.pathname.endsWith("/media")).length, 1);
  const adminData = await (await adminGet(adminRequest())).text();
  assert.ok(!adminData.includes("private-test-token") && !adminData.includes("access_token"));
});
test("concurrent synchronization reuses the previous gallery", async () => {
  seedConnection(); connection.posts = normalizeInstagramPosts(media); connection.synced_at = new Date().toISOString(); connection.sync_lock_until = new Date(Date.now() + 30000).toISOString();
  assert.equal((await loadInstagramFeed()).posts.length, 1);
  assert.equal(calls.filter(call => call.url.hostname === "graph.instagram.com").length, 0);
});
test("temporary provider failure preserves recent posts but hides stale media", async () => {
  seedConnection(); connection.posts = normalizeInstagramPosts(media); connection.synced_at = new Date().toISOString(); graphError = 4;
  assert.equal((await loadInstagramFeed(true)).posts.length, 1);
  connection.synced_at = new Date(Date.now() - 25 * 3600000).toISOString();
  assert.equal((await loadInstagramFeed(true)).posts.length, 0);
});
test("revoked token clears the gallery and requests reconnection", async () => {
  seedConnection(); connection.posts = normalizeInstagramPosts(media); connection.synced_at = new Date().toISOString(); graphError = 190;
  assert.equal((await loadInstagramFeed(true)).posts.length, 0);
  assert.equal(connection.last_error, "reconnect");
  assert.deepEqual(connection.posts, []);
});
test("near-expiry tokens are renewed before reading media", async () => {
  seedConnection(); connection.expires_at = new Date(Date.now() + 10 * 86400000).toISOString();
  await loadInstagramFeed();
  assert.equal(connection.access_token, "test-long-token");
  assert.ok(Date.parse(connection.expires_at) > Date.now() + 59 * 86400000);
  assert.equal(calls.filter(call => call.url.pathname === "/refresh_access_token").length, 1);
});
test("safe links, reel thumbnails, duplicates and missing thumbnails", () => {
  const normalized = normalizeInstagramPosts([rawPost, rawPost, { ...rawPost, id: "2", media_type: "VIDEO", media_url: "https://scontent.cdninstagram.com/video.mp4", thumbnail_url: "https://scontent.fbcdn.net/cover.jpg" }, { ...rawPost, id: "3", media_type: "VIDEO" }, { ...rawPost, id: "4", permalink: "javascript:alert(1)" }, { ...rawPost, id: "5", media_url: "https://attacker.example/image.jpg" }]);
  assert.equal(normalized.length, 4);
  assert.equal(normalized[1].imageUrl, "https://scontent.fbcdn.net/cover.jpg");
  assert.equal(normalized[2].imageUrl, null);
  assert.equal(normalized[3].imageUrl, null);
});
test("disconnect removes cached posts, credentials and pending logins", async () => {
  seedConnection(); state = { state_hash: "test" };
  assert.equal((await adminPost(adminRequest("disconnect"))).status, 200);
  assert.equal(connection, null); assert.equal(state, null);
  assert.deepEqual(await (await feedGet()).json(), { username: null, posts: [] });
});
test("missing configuration and storage do not break the storefront", async () => {
  delete process.env.INSTAGRAM_APP_ID;
  assert.equal((await adminPost(adminRequest("connect"))).status, 503);
  assert.deepEqual(await (await feedGet()).json(), { username: null, posts: [] });
  process.env.INSTAGRAM_APP_ID = "test-app"; storageFailure = true;
  assert.deepEqual(await (await feedGet()).json(), { username: null, posts: [] });
});
