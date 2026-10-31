import assert from "node:assert/strict";
import { test } from "node:test";
import { register } from "node:module";
register("./helpers/typescript-resolver.mjs", import.meta.url);
const { normalizeInstagramPostUrl, parseInstagramEmbedInput, readInstagramEmbedSetting, MAX_INSTAGRAM_EMBEDS } = await import("../lib/instagram-embeds.ts");

test("normaliza enlaces de posts y reels", () => {
  assert.equal(normalizeInstagramPostUrl("https://www.instagram.com/p/Deu-bGPiHFr/?igsh=abc123"), "https://www.instagram.com/p/Deu-bGPiHFr/");
  assert.equal(normalizeInstagramPostUrl("instagram.com/reel/De5PcuNgbD1"), "https://www.instagram.com/reel/De5PcuNgbD1/");
  assert.equal(normalizeInstagramPostUrl("https://www.instagram.com/reels/De5PcuNgbD1/"), "https://www.instagram.com/reel/De5PcuNgbD1/");
  assert.equal(normalizeInstagramPostUrl("https://www.instagram.com/galletisimacl/p/Deu-bGPiHFr/"), "https://www.instagram.com/p/Deu-bGPiHFr/");
});

test("rechaza lo que no es una publicación", () => {
  for (const bad of ["https://www.instagram.com/galletisimacl/", "https://evil.com/p/Deu-bGPiHFr/", "https://www.instagram.com/p/x\"onmouseover=1/", "javascript:alert(1)", ""]) {
    assert.equal(normalizeInstagramPostUrl(bad), null, bad);
  }
});

test("separa líneas, quita repetidos y respeta el máximo", () => {
  const many = Array.from({ length: MAX_INSTAGRAM_EMBEDS + 2 }, (_, i) => `https://www.instagram.com/p/Codigo${i}x/`);
  const parsed = parseInstagramEmbedInput(["https://www.instagram.com/p/Deu-bGPiHFr/", "https://www.instagram.com/p/Deu-bGPiHFr/?x=1", "hola", ...many].join("\n"));
  assert.equal(parsed.valid.length, MAX_INSTAGRAM_EMBEDS);
  assert.equal(parsed.valid[0], "https://www.instagram.com/p/Deu-bGPiHFr/");
  assert.deepEqual(parsed.invalid, ["hola"]);
  assert.equal(parsed.overLimit, true);
});

test("lee el ajuste guardado aunque venga dañado", () => {
  assert.deepEqual(readInstagramEmbedSetting('["https://www.instagram.com/reel/De5PcuNgbD1/", 5, "x"]'), ["https://www.instagram.com/reel/De5PcuNgbD1/"]);
  assert.deepEqual(readInstagramEmbedSetting("no-json"), []);
  assert.deepEqual(readInstagramEmbedSetting(null), []);
});
