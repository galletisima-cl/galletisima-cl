import assert from "node:assert/strict";
import test from "node:test";
import { campaignPageLocation } from "../lib/analytics.ts";

const origin = "https://www.galletisima.cl";

test("conserva los parámetros de campaña de los anuncios", () => {
  assert.equal(
    campaignPageLocation(origin, "/producto/calendario-de-adviento-1", "?utm_source=meta&utm_medium=paid&utm_campaign=adviento&utm_content=carrusel&fbclid=abc"),
    "https://www.galletisima.cl/producto/calendario-de-adviento-1?utm_source=meta&utm_medium=paid&utm_campaign=adviento&utm_content=carrusel&fbclid=abc",
  );
});

test("descarta cualquier otro parámetro de la URL", () => {
  assert.equal(
    campaignPageLocation(origin, "/", "?buscar=navidad&token=secreto&utm_source=meta"),
    "https://www.galletisima.cl/?utm_source=meta",
  );
});

test("sin parámetros queda la URL limpia", () => {
  assert.equal(campaignPageLocation(origin, "/checkout", ""), "https://www.galletisima.cl/checkout");
});
