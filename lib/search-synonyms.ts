import { SYNONYM_GROUPS } from "./search-synonyms-data";

// Minúsculas y sin tildes, para que "navideño" y "navideno" sean lo mismo.
export function normalizeSearch(text: string): string {
  return text
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizedGroups = SYNONYM_GROUPS.map((group) => group.map(normalizeSearch));

// Términos equivalentes a lo que escribió la persona: ella misma más los de cada
// grupo cuyo término calza completo (palabra o frase) dentro de la búsqueda.
export function expandSearchTerms(query: string): string[] {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];
  const padded = ` ${normalized} `;
  const terms = new Set([normalized]);
  for (const group of normalizedGroups) {
    if (group.some((term) => padded.includes(` ${term} `))) group.forEach((term) => terms.add(term));
  }
  return [...terms];
}

// Para usar en filtros: expande una vez y devuelve la función que evalúa cada texto.
export function createSearchMatcher(query: string): (text: string) => boolean {
  const terms = expandSearchTerms(query);
  if (terms.length === 0) return () => true;
  return (text: string) => {
    const normalized = normalizeSearch(text);
    return terms.some((term) => normalized.includes(term));
  };
}

type SearchableProduct = { name: string; product_categories?: { category_id: string }[] | null };
type SearchableCategory = { id: string; name: string };

// Resultados de búsqueda en dos bloques: primero los productos cuyo nombre calza,
// después los demás productos de las categorías cuyo nombre calza (sin repetir).
export function searchProducts<P extends SearchableProduct>(
  products: P[],
  categories: SearchableCategory[],
  query: string,
): { byName: P[]; byCategory: P[] } {
  if (!normalizeSearch(query)) return { byName: products, byCategory: [] };
  const matches = createSearchMatcher(query);
  const categoryIds = new Set(categories.filter((category) => matches(category.name)).map((category) => category.id));
  const byName: P[] = [];
  const byCategory: P[] = [];
  for (const product of products) {
    if (matches(product.name)) byName.push(product);
    else if (product.product_categories?.some((link) => categoryIds.has(link.category_id))) byCategory.push(product);
  }
  return { byName, byCategory };
}
