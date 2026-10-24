type NavLinkLike = { label: string; href: string };
type CategoryLike = { name: string; slug: string };

function normalize(value: string) {
  let text = value;
  try { text = decodeURIComponent(value); } catch { /* texto sin codificar */ }
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^todo /, "");
}

/**
 * Los enlaces fijos del menú (por ejemplo "Herramientas") apuntan a una búsqueda
 * como `/?buscar=herramientas#catalogo`. Si existe una categoría con ese nombre,
 * se enlaza a su página propia (`/categoria/<slug>`); si no, se deja el enlace tal cual.
 */
export function resolveNavHref(link: NavLinkLike, categories: CategoryLike[]) {
  const match = /^\/?\?buscar=([^#&]+)/.exec(link.href);
  if (!match) return link.href;
  const term = normalize(match[1]);
  const category = categories.find((item) => normalize(item.name) === term || normalize(item.slug) === term);
  return category ? `/categoria/${encodeURIComponent(category.slug)}` : link.href;
}
