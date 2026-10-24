import assert from "node:assert/strict";
import test from "node:test";
import { resolveNavHref } from "../lib/nav-link.ts";

const categories = [
  { name: "Todo Herramientas", slug: "herramientas" },
  { name: "Altares", slug: "todo-altares" },
  { name: "Navidad", slug: "navidad" },
];

test("enlace de búsqueda pasa a la página de su categoría", () => {
  assert.equal(resolveNavHref({ label: "Herramientas", href: "/?buscar=herramientas#catalogo" }, categories), "/categoria/herramientas");
  assert.equal(resolveNavHref({ label: "Altares", href: "/?buscar=altares#catalogo" }, categories), "/categoria/todo-altares");
});

test("sin categoría coincidente se conserva el enlace original", () => {
  const link = { label: "Cumpleaños", href: "/?buscar=cumpleanos#catalogo" };
  assert.equal(resolveNavHref(link, categories), link.href);
});

test("enlaces que no son búsquedas no se tocan", () => {
  assert.equal(resolveNavHref({ label: "Ver todo", href: "/?ver=todos#catalogo" }, categories), "/?ver=todos#catalogo");
  assert.equal(resolveNavHref({ label: "Más", href: "/contacto" }, categories), "/contacto");
});
