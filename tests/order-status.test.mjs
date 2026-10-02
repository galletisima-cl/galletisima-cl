import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { register } from "node:module";
register("./helpers/typescript-resolver.mjs", import.meta.url);

process.env.SUPABASE_URL = "https://status-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
process.env.RESEND_API_KEY = "test-only";
process.env.RESEND_FROM_EMAIL = "Galletísima <test@example.com>";
process.env.SELLER_NOTIFICATION_EMAIL = "seller@example.com";
const orderId = "00000000-0000-4000-8000-000000000001";
const eventId = "00000000-0000-4000-8000-000000000002";
const updatedAt = "2026-10-01T12:00:00Z";
const baseEvent = { id: eventId, order_id: orderId, order_number: "20261001001", status: "preparing", buyer_name: "Cliente <prueba>", recipient: "buyer@example.com", tracking_number: "", tracking_url: "", carrier: "", created_at: updatedAt, sent_at: null, first_attempt_at: null, email_payload: null };
let role, authFailure, rpcFailure, sendFailure, markFailure, event, sends, writes, rpcCalls, noEvent;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url || input.toString());
  assert.ok(["status-test.supabase.co", "api.resend.com"].includes(url.hostname), "Never contact a real database");
  const body = init?.body ? JSON.parse(init.body) : null;
  const method = init?.method || "GET";
  const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  if (url.hostname === "api.resend.com") {
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer test-only", "Never send with real credentials");
    assert.ok(event.email_payload, "Payload must be durable before send");
    sends.push({ body, key: new Headers(init.headers).get("Idempotency-Key") });
    return sendFailure ? reply({ error: "test failure" }, 503) : reply({ id: "test-email-id" });
  }
  if (url.pathname === "/auth/v1/user") return authFailure ? reply({ message: "Bad JWT" }, 401) : reply({ id: orderId, app_metadata: { role } });
  if (url.pathname === "/rest/v1/rpc/change_order_status") {
    rpcCalls.push(body);
    if (rpcFailure) return reply({ code: rpcFailure, message: "test conflict" }, 400);
    event.status = body.p_status; event.tracking_number = body.p_tracking_number; event.tracking_url = body.p_tracking_url; event.carrier = body.p_carrier;
    return reply({ changed: true, event_id: noEvent ? null : eventId, order: { id: orderId, status: body.p_status, updated_at: updatedAt, shipping_tracking_number: body.p_tracking_number, shipping_tracking_url: body.p_tracking_url, shipping_carrier: body.p_carrier } });
  }
  if (url.pathname === "/rest/v1/order_status_notifications") {
    if (method === "PATCH") {
      writes.push(body);
      if (markFailure && body.sent_at) return reply({ message: "test persistence failure" }, 500);
      Object.assign(event, body);
    }
    if (url.searchParams.has("order_id") && url.searchParams.get("order_id") !== `eq.${event.order_id}`) return reply(null);
    return reply(event);
  }
  throw new Error(`Unexpected request ${method} ${url.pathname}`);
};
after(() => { globalThis.fetch = originalFetch; });
beforeEach(() => {
  role = "admin"; authFailure = false; rpcFailure = null; sendFailure = false; markFailure = false;
  event = structuredClone(baseEvent); sends = []; writes = []; rpcCalls = []; noEvent = false;
});
const { POST } = await import("../app/api/orders/status/route.ts");
const { statusEmailPayload } = await import("../lib/order-status-email.ts");
const { safeTrackingUrl } = await import("../lib/order-status.ts");
const request = (patch = {}, token = "test-token") => new Request("http://localhost/api/orders/status", {
  method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ orderId, status: "preparing", expectedUpdatedAt: updatedAt, ...patch }),
});

test("only a verified administrator can update or resend", async () => {
  assert.equal((await POST(request({}, ""))).status, 401);
  authFailure = true;
  assert.equal((await POST(request())).status, 401);
  authFailure = false; role = "customer";
  assert.equal((await POST(request())).status, 403);
  assert.equal((await POST(request({ notificationId: eventId }))).status, 403);
  assert.equal(rpcCalls.length + sends.length + writes.length, 0);
});

test("shipped requires a number and a safe tracking URL before any write", async () => {
  for (const patch of [{}, { trackingNumber: "123" }, { trackingNumber: "123", trackingUrl: "javascript:alert(1)" }, { trackingNumber: "123", trackingUrl: "https://user:password@example.com/track" }, { trackingNumber: "\n", trackingUrl: "https://example.com/track" }]) {
    assert.equal((await POST(request({ status: "shipped", ...patch }))).status, 400);
  }
  assert.equal(rpcCalls.length + sends.length, 0);
});

test("shipped persists tracking and sends only to the stored customer", async () => {
  const response = await POST(request({ status: "shipped", trackingNumber: " ABC123 ", trackingUrl: "https://example.com/track?id=123&lang=es", carrier: "Blue Express", recipient: "attacker@example.com" }));
  assert.equal(response.status, 200);
  assert.ok((await response.json()).notification.sent_at);
  assert.equal(rpcCalls[0].p_tracking_number, "ABC123");
  assert.deepEqual(sends[0].body.to, ["buyer@example.com"]);
  assert.match(sends[0].body.subject, /Enviado/);
  assert.match(sends[0].body.text, /ABC123/);
  assert.match(sends[0].body.html, /Blue Express/);
  assert.match(sends[0].body.html, /id=123&amp;lang=es/);
  assert.match(sends[0].body.html, /Cliente &lt;prueba&gt;/);
});

test("each supported state has its own customer-facing email", async () => {
  for (const [status, label] of [["review", "Pendiente"], ["preparing", "Preparando"], ["delivered", "Entregado"], ["cancelled", "Cancelado"]]) {
    const payload = statusEmailPayload({ ...baseEvent, status });
    assert.match(payload.subject, new RegExp(label));
    assert.match(payload.text, new RegExp(`Estado: ${label}`));
    assert.ok(!payload.html.includes("Seguir mi envío"));
  }
});

test("delivery failures leave a durable pending notice and retry the exact payload/key", async () => {
  sendFailure = true;
  const first = await (await POST(request())).json();
  assert.equal(first.order.status, "preparing");
  assert.equal(first.notification.sent_at, null);
  assert.match(first.warning, /guardado/);
  sendFailure = false;
  const retried = await (await POST(request({ notificationId: eventId }))).json();
  assert.ok(retried.notification.sent_at);
  assert.equal(rpcCalls.length, 1, "Retry must not change the order again");
  assert.deepEqual(sends[0], sends[1]);
  await POST(request({ notificationId: eventId }));
  assert.equal(sends.length, 2, "Already confirmed email must not be sent again");
});

test("uncertain database acknowledgement uses the same Resend key on retry", async () => {
  markFailure = true;
  assert.match((await (await POST(request())).json()).warning, /no está confirmado/);
  markFailure = false;
  await POST(request({ notificationId: eventId }));
  assert.deepEqual(sends[0], sends[1]);
});

test("expired uncertain attempts stop instead of risking duplicates", async () => {
  event.email_payload = statusEmailPayload(event);
  event.first_attempt_at = new Date(Date.now() - 24 * 3600000).toISOString();
  const result = await (await POST(request({ notificationId: eventId }))).json();
  assert.match(result.warning, /Resend/);
  assert.equal(sends.length, 0);
});

test("conflicts and missing orders do not send email", async () => {
  rpcFailure = "40001";
  assert.equal((await POST(request())).status, 409);
  rpcFailure = "P0002";
  assert.equal((await POST(request())).status, 404);
  assert.equal(sends.length, 0);
});

test("a notification cannot be retried under another order", async () => {
  assert.equal((await POST(request({ orderId: "00000000-0000-4000-8000-000000000009", notificationId: eventId }))).status, 404);
  assert.equal(sends.length, 0);
});

test("unchanged orders without a notification do not send email", async () => {
  noEvent = true;
  assert.equal((await (await POST(request())).json()).notification, null);
  assert.equal(sends.length, 0);
});

test("invalid payloads and tracking protocols are rejected", async () => {
  for (const patch of [{ status: "unknown" }, { orderId: "x" }, { expectedUpdatedAt: "invalid" }, { notificationId: "x" }]) assert.equal((await POST(request(patch))).status, 400);
  for (const url of ["javascript:alert(1)", "data:text/html,hi", "//example.com", "https://example.com\n"]) assert.equal(safeTrackingUrl(url), null);
  assert.equal(safeTrackingUrl("https://example.com/track"), "https://example.com/track");
});
