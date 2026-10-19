import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { register } from "node:module";

register("./helpers/typescript-resolver.mjs", import.meta.url);
const originalAccessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN;
process.env.META_CONVERSIONS_ACCESS_TOKEN = "test-only-meta-token";

const originalFetch = globalThis.fetch;
let requests;

beforeEach(() => {
  requests = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url || input.toString());
    assert.equal(url.hostname, "graph.facebook.com", "Never contact a real Meta endpoint in tests");
    requests.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  if (originalAccessToken === undefined) delete process.env.META_CONVERSIONS_ACCESS_TOKEN;
  else process.env.META_CONVERSIONS_ACCESS_TOKEN = originalAccessToken;
});

test("sends hashed purchase identifiers and a deduplicatable event to Meta", async () => {
  const { sendMetaConversionEvent } = await import("../lib/meta-conversions.ts");
  const headers = new Headers({
    host: "www.galletisima.cl",
    "x-real-ip": "192.0.2.1",
    "user-agent": "Meta CAPI test",
    cookie: "_fbp=fb.1.123.456; _fbc=fb.1.123.click",
  });

  await sendMetaConversionEvent({
    eventName: "Purchase",
    eventId: "order-123",
    eventSourceUrl: "https://www.galletisima.cl/pago/resultado?token_ws=private",
    customData: {
      content_ids: ["product-1"],
      contents: [{ id: "product-1", quantity: 2, item_price: 1500 }],
      content_type: "product",
      currency: "CLP",
      num_items: 2,
      value: 3000,
      order_id: "order-123",
    },
    headers,
    email: " BUYER@EXAMPLE.COM ",
    phone: "+56 9 1234 5678",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.searchParams.get("access_token"), "test-only-meta-token");
  const event = requests[0].body.data[0];
  assert.equal(event.event_id, "order-123");
  assert.equal(event.event_source_url, "https://www.galletisima.cl/pago/resultado");
  assert.equal(event.user_data.client_ip_address, "192.0.2.1");
  assert.equal(event.user_data.client_user_agent, "Meta CAPI test");
  assert.equal(event.user_data.fbp, "fb.1.123.456");
  assert.equal(event.user_data.fbc, "fb.1.123.click");
  assert.match(event.user_data.em[0], /^[a-f0-9]{64}$/);
  assert.match(event.user_data.ph[0], /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(requests[0].body), /BUYER@EXAMPLE\.COM|test-only-meta-token|token_ws=private/i);
});

test("rejects event source URLs outside the production website", async () => {
  const { sendMetaConversionEvent } = await import("../lib/meta-conversions.ts");
  await assert.rejects(sendMetaConversionEvent({
    eventName: "AddToCart",
    eventId: "event-1",
    eventSourceUrl: "https://attacker.example/product",
    customData: {
      content_ids: ["product-1"],
      contents: [{ id: "product-1", quantity: 1, item_price: 1000 }],
      content_type: "product",
      currency: "CLP",
      num_items: 1,
      value: 1000,
    },
    headers: new Headers({ host: "www.galletisima.cl" }),
  }), /producción/);
  assert.equal(requests.length, 0);
});
