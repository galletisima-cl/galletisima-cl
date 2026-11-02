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
