export type CsvImportProduct = {
  row: number; permalink: string; name: string; description: string; sku: string;
  categories: string[]; images: string[]; active: boolean; featured: boolean;
  stock: number; price: number; sizes: string[]; sizePrices: Record<string, number>;
};
export type CsvImportPreview = { products: CsvImportProduct[]; errors: string[]; warnings: string[]; sourceRows: number };

const REQUIRED_HEADERS = ["Permalink", "Name", "Categories", "SKU", "Price", "Stock", "Stock Unlimited", "Status", "Featured"];
const ACTIVE_STATUSES = new Set(["active", "published", "available", "activo", "publicado", "disponible"]);
const INACTIVE_STATUSES = new Set(["draft", "unavailable", "hidden", "inactive", "borrador", "oculto", "inactivo", "no disponible"]);

function parseCsvRows(text: string) {
  let source = text.replace(/^\uFEFF/, "");
  const separatorDirective = source.match(/^sep=([,;])\r?\n/i);
  const forcedDelimiter = separatorDirective?.[1];
  if (separatorDirective) source = source.slice(separatorDirective[0].length);
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const delimiter = forcedDelimiter || ((firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ";" : ",");
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value); value = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else value += character;
  }
  if (quoted) throw new Error("Hay una comilla sin cerrar en el archivo");
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function integerValue(value: string, allowThousands: boolean) {
  const raw = value.trim().replace(/[$\s]/g, "");
  if (!raw || raw.startsWith("-")) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  let normalized = raw;
  if (allowThousands && /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (allowThousands && /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(raw)) normalized = raw.replace(/,/g, "");
  else if (/^\d+[.,]\d{1,2}$/.test(raw)) normalized = raw.replace(",", ".");
  else return null;
  const parsed = Number(normalized);
  if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  return null;
}
function booleanValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["yes", "si", "sí", "true", "1"].includes(normalized)) return true;
  if (["no", "false", "0", ""].includes(normalized)) return false;
  return null;
}
function cleanSku(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function splitImages(value: string) { return value.split(/\s*[|;\n]\s*|\s*,\s*(?=https?:\/\/)/i).map((image) => image.trim()).filter(Boolean); }
function isWebUrl(value: string) { try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; } }

export function parseProductCsv(text: string): CsvImportPreview {
  const errors: string[] = [], warnings: string[] = [];
  let rows: string[][];
  try { rows = parseCsvRows(text); }
  catch (error) { return { products: [], errors: [error instanceof Error ? error.message : "El CSV no es válido"], warnings, sourceRows: 0 }; }
  if (rows.length < 2) return { products: [], errors: ["El archivo no contiene productos"], warnings, sourceRows: 0 };
  const headers = rows[0].map((header) => header.trim());
  const duplicates = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  if (duplicates.length) return { products: [], errors: [`Hay columnas repetidas: ${[...new Set(duplicates)].join(", ")}`], warnings, sourceRows: rows.length - 1 };
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) return { products: [], errors: [`Faltan columnas obligatorias: ${missing.join(", ")}`], warnings, sourceRows: rows.length - 1 };
  if (rows.length - 1 > 5000) return { products: [], errors: ["El archivo supera el máximo de 5.000 filas"], warnings, sourceRows: rows.length - 1 };
  const records = rows.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) errors.push(`Fila ${index + 2}: contiene ${cells.length} columnas; se esperaban ${headers.length}`);
    return { row: index + 2, values: Object.fromEntries(headers.map((header, column) => [header, (cells[column] || "").trim()])) };
  });
  const groups = new Map<string, typeof records>();
  for (const record of records) {
    const permalink = record.values.Permalink;
    if (!permalink) { errors.push(`Fila ${record.row}: falta Permalink`); continue; }
    groups.set(permalink, [...(groups.get(permalink) || []), record]);
  }
  const products: CsvImportProduct[] = [], seenSkus = new Set<string>();
  for (const [permalink, group] of groups) {
    const base = group.find((record) => record.values.Name) || group[0];
    const name = base.values.Name;
    const sku = cleanSku(base.values.SKU || group.find((record) => record.values.SKU)?.values.SKU || "");
    const categories = (base.values.Categories || "").split(",").map((category) => category.trim()).filter(Boolean);
    if (!name) errors.push(`Fila ${base.row}: falta Name para ${permalink}`);
    if (!sku) errors.push(`Fila ${base.row}: falta un SKU válido para ${permalink}`);
    if (!categories.length) errors.push(`Fila ${base.row}: falta Categories para ${permalink}`);
    if (seenSkus.has(sku)) errors.push(`SKU duplicado en el archivo: ${sku}`);
    if (sku) seenSkus.add(sku);
    const status = (base.values.Status || "").toLowerCase();
    if (!ACTIVE_STATUSES.has(status) && !INACTIVE_STATUSES.has(status)) errors.push(`Fila ${base.row}: Status inválido “${base.values.Status}”`);
    const featured = booleanValue(base.values.Featured || ""), unlimited = booleanValue(base.values["Stock Unlimited"] || "");
    if (featured === null) errors.push(`Fila ${base.row}: Featured debe ser Sí o No`);
    if (unlimited === null) errors.push(`Fila ${base.row}: Stock Unlimited debe ser Sí o No`);
    const stock = unlimited ? 999999 : integerValue(base.values.Stock || "", false);
    if (stock === null) errors.push(`Fila ${base.row}: Stock debe ser un número entero igual o mayor que cero`);
    const sizePrices: Record<string, number> = {};
    for (const record of group) {
      const size = record.values["Variant 1 Option Value"] || "";
      if (!size) continue;
      const variantPrice = integerValue(record.values.Price || "", true);
      if (!variantPrice || variantPrice <= 0) errors.push(`Fila ${record.row}: precio inválido para la variante “${size}”`);
      else if (sizePrices[size] !== undefined) errors.push(`Producto ${name || permalink}: variante duplicada “${size}”`);
      else sizePrices[size] = variantPrice;
    }
    const sizes = Object.keys(sizePrices);
    const images = [...new Set(group.flatMap((record) => [...splitImages(record.values.Images || ""), ...splitImages(record.values["Variant Image"] || "")]))];
    images.filter((image) => !isWebUrl(image)).forEach((image) => errors.push(`${name || permalink}: URL de imagen inválida “${image}”`));
    if (images.length > 8) warnings.push(`${name || permalink}: incluye ${images.length} imágenes; solo se importarán las primeras 8`);
    if (!images.length) warnings.push(`${name || permalink}: no incluye imágenes; se conservarán las existentes`);
    const price = integerValue(base.values.Price || "", true) || Math.min(...Object.values(sizePrices));
    if (!price || !Number.isFinite(price)) errors.push(`Fila ${base.row}: falta un precio válido y mayor que cero para ${name || permalink}`);
    products.push({ row: base.row, permalink, name, description: base.values.Description || "", sku, categories, images: images.slice(0, 8), active: ACTIVE_STATUSES.has(status), featured: featured ?? false, stock: stock ?? 0, price, sizes, sizePrices });
  }
  return { products, errors, warnings, sourceRows: records.length };
}
