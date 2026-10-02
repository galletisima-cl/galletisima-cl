import assert from "node:assert/strict";
import test from "node:test";
import { applyDiscounts, parseDiscountRules, validateDiscountRule } from "../lib/discounts.ts";

const productA = "00000000-0000-4000-8000-000000000001";
const productB = "00000000-0000-4000-8000-000000000002";
const line = (productId = productA, unitPrice = 10000, quantity = 2) => ({ productId, unitPrice, quantity });
const rule = (patch = {}) => validateDiscountRule({ id: "offer", name: "Oferta", kind: "order", active: true, valueType: "percentage", value: 10, minSubtotal: 0, productId: null, ...patch });

test("an unconfigured store keeps its original totals", () => {
  assert.deepEqual(applyDiscounts([line()], 3990, parseDiscountRules(null)), { subtotal: 20000, discountAmount: 0, shipping: 3990, shippingDiscount: 0, total: 23990, appliedDiscounts: [] });
});
test("free shipping applies at the minimum before discounts, not below it", () => {
  const rules = [rule(), rule({ id: "shipping", kind: "free_shipping", minSubtotal: 20000 })];
  assert.equal(applyDiscounts([line()], 3990, rules).total, 18000);
  assert.equal(applyDiscounts([line(productA, 19999, 1)], 3990, rules).shipping, 3990);
});
test("minimum order discount excludes shipping from eligibility", () => {
  const rules = [rule({ kind: "minimum_order", minSubtotal: 20000, valueType: "fixed", value: 3000 })];
  assert.equal(applyDiscounts([line()], 3990, rules).discountAmount, 3000);
  assert.equal(applyDiscounts([line(productA, 18000, 1)], 3990, rules).discountAmount, 0);
});
test("fixed product discounts apply per unit and only to the selected product", () => {
  const rules = [rule({ kind: "product", productId: productA, valueType: "fixed", value: 1500 })];
  const result = applyDiscounts([line(), line(productB)], 3990, rules);
  assert.equal(result.discountAmount, 3000);
  assert.equal(result.total, 40990);
});
test("chooses the largest product offer without stacking duplicates", () => {
  const rules = [rule({ id: "small", kind: "product", productId: productA }), rule({ id: "large", kind: "product", productId: productA, value: 25 })];
  const result = applyDiscounts([line()], 3990, rules);
  assert.equal(result.discountAmount, 5000);
  assert.equal(result.appliedDiscounts.length, 1);
  assert.equal(result.appliedDiscounts[0].id, "large");
});
test("chooses between product savings and total savings, plus free shipping", () => {
  const rules = [rule({ id: "product", kind: "product", productId: productA, value: 10 }), rule({ id: "cart", value: 15 }), rule({ id: "ship", kind: "free_shipping" })];
  const result = applyDiscounts([line()], 3990, rules);
  assert.equal(result.discountAmount, 3000);
  assert.equal(result.total, 17000);
  assert.deepEqual(result.appliedDiscounts.map(d => d.id), ["cart", "ship"]);
});
test("combines offers for different products when better than a total offer", () => {
  const rules = [rule({ id: "a", kind: "product", productId: productA, value: 20 }), rule({ id: "b", kind: "product", productId: productB, value: 30 }), rule({ id: "cart", value: 10 })];
  assert.equal(applyDiscounts([line(), line(productB)], 0, rules).discountAmount, 10000);
});
test("disabled promotions never apply", () => {
  assert.equal(applyDiscounts([line()], 3990, [rule({ active: false })]).discountAmount, 0);
});
test("caps fixed discounts and never produces negative totals", () => {
  assert.equal(applyDiscounts([line()], 0, [rule({ valueType: "fixed", value: 999999 })]).total, 0);
  assert.equal(applyDiscounts([line()], 0, [rule({ kind: "product", productId: productA, valueType: "fixed", value: 999999 })]).discountAmount, 20000);
});
test("rounds in whole pesos consistently even when cart rows are split", () => {
  const rules = [rule({ kind: "product", productId: productA, value: 33 })];
  const combined = applyDiscounts([line(productA, 999, 3)], 0, rules);
  const split = applyDiscounts([line(productA, 999, 1), line(productA, 999, 2)], 0, rules);
  assert.deepEqual(combined, split);
  assert.equal(combined.discountAmount, 987);
});
test("rejects malformed configurations and duplicate IDs", () => {
  for (const value of ["{", "{}", '[null]', JSON.stringify([rule(), rule()])]) assert.throws(() => parseDiscountRules(value));
  for (const patch of [{ value: 101 }, { value: -1 }, { value: 1.5 }, { minSubtotal: -1 }, { kind: "minimum_order", minSubtotal: 0 }, { kind: "product", productId: null }, { active: "false" }]) assert.throws(() => rule(patch));
});
test("rejects invalid prices and integer overflow", () => {
  assert.throws(() => applyDiscounts([line(productA, -1)], 0, []));
  assert.throws(() => applyDiscounts([line()], -1, []));
  assert.throws(() => applyDiscounts([line(productA, Number.MAX_SAFE_INTEGER)], 0, []));
});
