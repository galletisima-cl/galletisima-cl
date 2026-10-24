import assert from "node:assert/strict";
import { test } from "node:test";
import { register } from "node:module";
register("./helpers/typescript-resolver.mjs", import.meta.url);

const { EMAIL_GROUPS, emailSubject, emailText, parseEmailTemplates } = await import("../lib/email-templates.ts");
const { orderEmailHtml, orderEmailSubject } = await import("../lib/email.ts");
const { statusEmailContent } = await import("../lib/order-status-email.ts");

const order = {
  id: "o1", buy_order: "B1", public_order_number: "20261024001", total: 7600, buyer_name: "Ana <b>", buyer_email: "ana@example.com",
  buyer_phone: "", shipping: 3500, shipping_region: "RM", shipping_commune: "La Florida", shipping_address: "Calle 1", shipping_address_extra: "",
  payment_status: "authorized", authorization_code: "1", payment_type_code: "VD", card_last_four: "1234", installments_number: 0, transaction_date: null, email_sent_at: null,
};
const lines = [{ name: "Cortador", size: "8 cm", quantity: 2, unit_price: 2000, line_total: 4000 }];
const statusEvent = { id: "e1", order_id: "o1", status: "preparing", order_number: "20261024001", buyer_name: "Ana", recipient: "ana@example.com", tracking_number: "", tracking_url: "", carrier: "", created_at: "", sent_at: null, first_attempt_at: null, email_payload: null };

test("sin textos guardados se usan los originales", () => {
  assert.equal(orderEmailSubject(order, "buyer"), "Pedido 20261024001 confirmado · Galletísima");
  assert.match(orderEmailHtml(order, lines, "buyer"), /¡Gracias por tu compra!/);
  assert.equal(statusEmailContent(statusEvent).subject, "Pedido 20261024001 · Preparando · Galletísima");
  assert.match(statusEmailContent(statusEvent).html, /Estamos preparando tus productos/);
});

test("los textos guardados reemplazan a los originales y completan variables", () => {
  const templates = parseEmailTemplates(JSON.stringify({ "buyer.title": "¡Listo, {nombre}!", "buyer.subject": "Tu pedido {numero_pedido}\nya está", "status.preparing": "Manos a la obra con tu pedido {numero_pedido}." }));
  assert.equal(orderEmailSubject(order, "buyer", templates), "Tu pedido 20261024001 ya está");
  assert.match(orderEmailHtml(order, lines, "buyer", templates), /¡Listo, Ana &lt;b&gt;!/);
  const status = statusEmailContent(statusEvent, templates);
  assert.match(status.html, /Manos a la obra con tu pedido 20261024001\./);
  assert.match(status.text, /Manos a la obra/);
});

test("el HTML escapa lo que se escribe en el admin", () => {
  const templates = parseEmailTemplates({ "buyer.intro": "<script>x</script>\nSegunda línea" });
  const html = orderEmailHtml(order, lines, "buyer", templates);
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;<br>Segunda línea/);
});

test("solo se guardan campos conocidos, de texto y distintos del original", () => {
  const original = EMAIL_GROUPS[0].fields[1].defaultText;
  assert.deepEqual(parseEmailTemplates({ "buyer.title": original, "otro.campo": "x", "buyer.intro": 5, "buyer.button": "  Ver mi pedido  " }), { "buyer.button": "Ver mi pedido" });
  assert.deepEqual(parseEmailTemplates("no es json"), {});
  assert.deepEqual(parseEmailTemplates(null), {});
});

test("variables desconocidas quedan tal cual", () => {
  assert.equal(emailText({ "seller.title": "Venta de {nombre} {foo}" }, "seller.title", { nombre: "Ana" }), "Venta de Ana {foo}");
  assert.equal(emailSubject({}, "status.subject", { numero_pedido: "1", estado: "Enviado" }), "Pedido 1 · Enviado · Galletísima");
});
