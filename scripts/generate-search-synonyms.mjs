// Genera lib/search-synonyms-data.ts a partir de lib/sinonimos-busqueda.txt.
// Uso: node scripts/generate-search-synonyms.mjs
// El .txt es la lista que se edita; el bot de WhatsApp lee el mismo archivo.
import { readFileSync, writeFileSync } from "node:fs";

const source = new URL("../lib/sinonimos-busqueda.txt", import.meta.url);
const target = new URL("../lib/search-synonyms-data.ts", import.meta.url);

const groups = readFileSync(source, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.replace(/\(\*\)\s*$/, "").trim())
  .map((line) => line.split("=").map((term) => term.trim()).filter(Boolean))
  .filter((terms) => terms.length > 1);

const body = groups.map((terms) => `  ${JSON.stringify(terms)},`).join("\n");
writeFileSync(
  target,
  `// Archivo generado por scripts/generate-search-synonyms.mjs desde lib/sinonimos-busqueda.txt. No editar a mano.\nexport const SYNONYM_GROUPS: string[][] = [\n${body}\n];\n`,
);
console.log(`${groups.length} grupos escritos`);
