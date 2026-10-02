import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { register } from "node:module";
register("./helpers/typescript-resolver.mjs", import.meta.url);

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://discount-test.supabase.co";
process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-only";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
process.env.WEBPAY_ENVIRONMENT = "integration";

const productId = "00000000-0000-4000-8000-000000000001";
const buyer = { name: "Cliente de prueba", email: "preview@example.com", phone: "", communeId: "13101", address: "Calle de prueba 123", addressExtra: "" };
const items = [{ productId, size: "6 cm", quantity: 2 }];
const offer = (patch = {}) => ({ id: "discount", name: "Diez por ciento", kind: "order", active: true, valueType: "percentage", value: 10, minSubtotal: 0, productId: null, ...patch });
let rules, writes, payments, settingsFailure;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url || input.toString());
  assert.equal(url.hostname, "discount-test.supabase.co", "Tests must never contact a real service");
  const path = url.pathname;
  const method = init?.method || "GET";
  const body = init?.body ? JSON.parse(init.body) : null;
  let data = [];
  if (path === "/rest/v1/products") data = [{ id: productId, name: "Molde", price: 10000, size: "6 cm,8 cm", active: true }];
  else if (path === "/rest/v1/site_settings") {
    if (settingsFailure) return new Response(JSON.stringify({ message: "Test read failure" }), { status: 500, headers: { "Content-Type": "application/json" } });
    data = [{ key: "product_size_prices", value: JSON.stringify({ [productId]: { "8 cm": 12000 } }) }, { key: "automatic_discounts", value: JSON.stringify(rules) }];
  } else if (path === "/rest/v1/shipping_rates") data = [{ commune_id: "13101", price: 3990, active: true }];
  else if (path === "/rest/v1/rpc/next_order_number") data = "20261001001";
  else if (path === "/rest/v1/orders" && method === "POST") { writes.push({ table: "orders", body }); data = { id: "test-order" }; }
  else if (path === "/rest/v1/order_items" && method === "POST") { writes.push({ table: "order_items", body }); }
  else throw new Error(`Unexpected test request: ${method} ${path}`);
  return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
};

const { POST: quote } = await import("../app/api/checkout/quote/route.ts");
const { POST: pay } = await import("../app/api/webpay/create/route.ts");
const { getWebpayTransaction } = await import("../lib/webpay.ts");
const transactionPrototype = Object.getPrototypeOf(getWebpayTransaction());
const originalCreate = transactionPrototype.create;
transactionPrototype.create = async (buyOrder, sessionId, amount) => {
  payments.push({ buyOrder, sessionId, amount });
  return { url: "https://webpay.test/checkout", token: "test-token" };
};
after(() => { globalThis.fetch = originalFetch; transactionPrototype.create = originalCreate; });
beforeEach(() => { rules = []; writes = []; payments = []; settingsFailure = false; });
const request = (body) => new Request("http://localhost/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("quotes automatic offers using server prices and ignores client discount amounts", async () => {
  rules = [offer(), offer({ id: "ship", name: "Envío gratis", kind: "free_shipping", minSubtotal: 20000 })];
  const response = await quote(request({ communeId: "13101", items: items.map(item => ({ ...item, unitPrice: 1 })), subtotal: 1, discountAmount: 999999 }));
  assert.equal(response.status, 200);
  const { pricing } = await response.json();
  assert.equal(pricing.subtotal, 20000);
  assert.equal(pricing.discountAmount, 2000);
  assert.equal(pricing.shipping, 0);
  assert.equal(pricing.total, 18000);
  assert.equal(payments.length, 0);
  assert.equal(writes.length, 0);
});

test("quote and payment apply a manual coupon only when explicitly supplied", async () => {
  rules = [offer({ code: "HALLOWEEN25", value: 25 }), offer({ id: "shipping", kind: "free_shipping", minSubtotal: 20000 })];
  const automatic = await (await quote(request({ communeId: "13101", items }))).json();
  assert.equal(automatic.pricing.discountAmount, 0);
  assert.equal(automatic.pricing.shipping, 0);
  assert.equal(automatic.pricing.total, 20000);
  const applied = await (await quote(request({ communeId: "13101", items, couponCode: " halloween25 " }))).json();
  assert.equal(applied.pricing.total, 15000);
  assert.deepEqual(applied.pricing.coupon, { code: "HALLOWEEN25", applied: true });
  const missingCode = await pay(request({ buyer, items, expectedTotal: 15000, discountAmount: 5000 }));
  assert.equal(missingCode.status, 409);
  assert.equal(payments.length, 0);
  const paid = await pay(request({ buyer, items, expectedTotal: 15000, couponCode: "halloween25" }));
  assert.equal(paid.status, 200);
  assert.equal(payments[0].amount, 15000);
  const order = writes.find(write => write.table === "orders").body;
  assert.equal(order.applied_discounts[0].code, "HALLOWEEN25");
  assert.equal(order.discount_amount, 5000);
});

test("invalid, ineligible and newly deactivated coupons cannot reach Webpay", async () => {
  for (const configured of [offer({ code: "HALLOWEEN25", active: false }), offer({ code: "HALLOWEEN25", minSubtotal: 30000 }), offer({ code: "OTHER" })]) {
    rules = [configured];
    assert.equal((await quote(request({ communeId: "13101", items, couponCode: "HALLOWEEN25" }))).status, 400);
    assert.equal((await pay(request({ buyer, items, couponCode: "HALLOWEEN25", expectedTotal: 15000 }))).status, 400);
  }
  assert.equal(payments.length, 0);
  assert.equal(writes.length, 0);
});

test("coupon value changes return a new total before any payment", async () => {
  rules = [offer({ code: "SAVE", value: 25 })];
  const initial = await (await quote(request({ communeId: "13101", items, couponCode: "SAVE" }))).json();
  rules = [offer({ code: "SAVE", value: 10 })];
  const response = await pay(request({ buyer, items, couponCode: "SAVE", expectedTotal: initial.pricing.total }));
  assert.equal(response.status, 409);
  const {pricing} = await response.json();
  assert.equal(pricing.total, 21990);
  assert.deepEqual(pricing.coupon, { code: "SAVE", applied: true });
  assert.equal(payments.length, 0);
});
test("quotes product discounts against the selected size's server price", async () => {
  rules = [offer({ kind: "product", productId, value: 25 })];
  const response = await quote(request({ communeId: "13101", items: [{ productId, size: "8 cm", quantity: 2 }] }));
  const { pricing } = await response.json();
  assert.equal(pricing.subtotal, 24000);
  assert.equal(pricing.discountAmount, 6000);
  assert.equal(pricing.total, 21990);
});
test("payment uses the same discounted total and saves its immutable breakdown", async () => {
  rules = [offer(), offer({ id: "ship", name: "Envío gratis", kind: "free_shipping" })];
  const response = await pay(request({ buyer, items, expectedTotal: 18000 }));
  assert.equal(response.status, 200);
  assert.equal(payments[0].amount, 18000);
  const stored = writes.find(write => write.table === "orders").body;
  assert.equal(stored.subtotal, 20000);
  assert.equal(stored.total, 18000);
  assert.equal(stored.shipping, 0);
  assert.equal(stored.discount_amount, 2000);
  assert.equal(stored.shipping_discount, 3990);
  assert.deepEqual(stored.applied_discounts.map(discount => discount.amount), [2000, 3990]);
  assert.equal(writes.find(write => write.table === "order_items").body[0].unit_price, 10000);
});
test("promotion changes require confirmation before creating any payment", async () => {
  rules = [offer()];
  const initial = await (await quote(request({ communeId: "13101", items }))).json();
  rules = [];
  const response = await pay(request({ buyer, items, expectedTotal: initial.pricing.total }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).pricing.total, 23990);
  assert.equal(payments.length, 0);
  assert.equal(writes.length, 0);
});
test("a tampered or missing total cannot reach the payment provider", async () => {
  for (const expectedTotal of [1, undefined]) assert.equal((await pay(request({ buyer, items, expectedTotal }))).status, 409);
  assert.equal(payments.length, 0);
});
test("invalid carts and missing shipping are rejected", async () => {
  for (const body of [{ communeId: "13101", items: [null] }, { communeId: "13101", items: [] }, { communeId: "00000", items }, { items }]) assert.equal((await quote(request(body))).status, 400);
});
test("a settings failure does not silently omit discounts", async () => {
  settingsFailure = true;
  assert.equal((await quote(request({ communeId: "13101", items }))).status, 400);
});
test("free orders are rejected before Webpay instead of charging an invented amount", async () => {
  rules = [offer({ value: 100 }), offer({ id: "ship", kind: "free_shipping" })];
  const response = await quote(request({ communeId: "13101", items }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /mayor a \$0/);
});
