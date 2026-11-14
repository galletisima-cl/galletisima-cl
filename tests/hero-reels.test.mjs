import assert from "node:assert/strict";
import test from "node:test";
import { HERO_REELS, reelImages } from "../lib/hero-reels.ts";

const products = [
  { slug: "a", price: 1, image_url: "a0", product_images: [{ image_url: "a1", sort_order: 1 }, { image_url: "a0", sort_order: 0 }] },
  { slug: "b", price: 1, image_url: "b0", product_images: [] },
];

test("alterna las fotos de varios productos en orden", () => {
  assert.deepEqual(reelImages({ productSlugs: ["a", "b"] }, products), ["a0", "b0", "a1"]);
});

test("respeta el máximo de fotos y omite productos que no existen", () => {
  assert.deepEqual(reelImages({ productSlugs: ["x", "a"] }, products, 1), ["a0"]);
});

test("las láminas de la portada tienen destino y productos", () => {
  for (const reel of HERO_REELS) {
    assert.ok(reel.href.startsWith("/"));
    assert.ok(reel.productSlugs.length > 0);
  }
});
