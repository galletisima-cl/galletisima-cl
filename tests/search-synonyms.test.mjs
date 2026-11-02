import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

register("./helpers/typescript-resolver.mjs", import.meta.url);
const { createSearchMatcher, expandSearchTerms, normalizeSearch } = await import("../lib/search-synonyms.ts");

test("normaliza tildes, mayúsculas y espacios", () => {
  assert.equal(normalizeSearch("  Navideño  Ñandú "), "navideno nandu");
});

test("viejo pascuero encuentra Santa Claus y viceversa", () => {
  const matches = createSearchMatcher("viejo pascuero");
  assert.ok(matches("Santa Claus"));
  assert.ok(matches("Pascuero con regalos"));
  assert.ok(createSearchMatcher("santa")("Viejito Pascuero"));
});

test("las variantes de casita de jengibre calzan entre sí", () => {
  const matches = createSearchMatcher("casa jengibre");
  assert.ok(matches("Set Casita de Jengibre"));
});

test("una búsqueda sin sinónimos sigue siendo literal", () => {
  const matches = createSearchMatcher("pesas");
  assert.ok(matches("Pesas fitness"));
  assert.ok(!matches("Santa Claus"));
  assert.deepEqual(expandSearchTerms("pesas"), ["pesas"]);
});

test("búsqueda vacía muestra todo", () => {
  assert.ok(createSearchMatcher("   ")("lo que sea"));
});

test("no mezcla grupos por coincidencia parcial dentro de una palabra", () => {
  assert.ok(!expandSearchTerms("santander").includes("viejo pascuero"));
});

test("muestra primero los que calzan por nombre y luego el resto de la categoría", async () => {
  const { searchProducts } = await import("../lib/search-synonyms.ts");
  const categories = [{ id: "nav", name: "Todo Navidad" }, { id: "hal", name: "Halloween" }];
  const products = [
    { name: "Reno", product_categories: [{ category_id: "nav" }] },
    { name: "Gorro de Navidad", product_categories: [{ category_id: "nav" }] },
    { name: "Calabaza", product_categories: [{ category_id: "hal" }] },
    { name: "Árbol navideño", product_categories: [] },
  ];
  const { byName, byCategory } = searchProducts(products, categories, "Navidad");
  assert.deepEqual(byName.map((p) => p.name), ["Gorro de Navidad", "Árbol navideño"]);
  assert.deepEqual(byCategory.map((p) => p.name), ["Reno"]);
});

test("los sinónimos también encuentran la categoría", async () => {
  const { searchProducts } = await import("../lib/search-synonyms.ts");
  const categories = [{ id: "nav", name: "Navidad" }];
  const products = [{ name: "Reno", product_categories: [{ category_id: "nav" }] }];
  assert.equal(searchProducts(products, categories, "christmas").byCategory.length, 1);
});
