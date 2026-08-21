export type CsvImportProduct = {
  row: number;
  permalink: string;
  name: string;
  description: string;
  sku: string;
  categories: string[];
  images: string[];
  active: boolean;
  featured: boolean;
  stock: number;
  price: number;
  sizes: string[];
  sizePrices: Record<string, number>;
};

export type CsvImportPreview = {
  products: CsvImportProduct[];
  errors: string[];
  warnings: string[];
  sourceRows: number;
};

function parseCsvRows(text: string) {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value); value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value); value = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else value += character;
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function numberValue(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function yes(value: string) {
  return /^(yes|si|sí|true|1)$/i.test(value.trim());
}

function cleanSku(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function splitImages(value: string) {
  return value.split(/\s*[|;\n]\s*|\s*,\s*(?=https?:\/\/)/i).map((image) => image.trim()).filter(Boolean);
}

export function parseProductCsv(text: string): CsvImportPreview {
  const rows = parseCsvRows(text);
  const errors: string[] = [], warnings: string[] = [];
  if (rows.length < 2) return { products: [], errors: ["El archivo no contiene productos"], warnings, sourceRows: 0 };
  const headers = rows[0].map((header) => header.trim());
  const required = ["Permalink", "Name", "Categories", "SKU", "Price"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) return { products: [], errors: [`Faltan columnas obligatorias: ${missing.join(", ")}`], warnings, sourceRows: rows.length - 1 };
  const records = rows.slice(1).map((cells, index) => ({ row: index + 2, values: Object.fromEntries(headers.map((header, column) => [header, (cells[column] || "").trim()])) }));
  const groups = new Map<string, typeof records>();
  for (const record of records) {
    const permalink = record.values.Permalink;
    if (!permalink) { errors.push(`Fila ${record.row}: falta Permalink`); continue; }
    groups.set(permalink, [...(groups.get(permalink) || []), record]);
  }
  const products: CsvImportProduct[] = [];
  const seenSkus = new Set<string>();
  for (const [permalink, group] of groups) {
    const base = group.find((record) => record.values.Name) || group[0];
    const name = base.values.Name;
    const sku = cleanSku(base.values.SKU || group.find((record) => record.values.SKU)?.values.SKU || "");
    const categories = base.values.Categories.split(",").map((category) => category.trim()).filter(Boolean);
    if (!name) errors.push(`Fila ${base.row}: falta Name para ${permalink}`);
    if (!sku) errors.push(`Fila ${base.row}: falta un SKU válido para ${permalink}`);
    if (!categories.length) errors.push(`Fila ${base.row}: falta Categories para ${permalink}`);
    if (seenSkus.has(sku)) errors.push(`SKU duplicado en el archivo: ${sku}`);
    seenSkus.add(sku);
    const sizePrices: Record<string, number> = {};
    for (const record of group) {
      const size = record.values["Variant 1 Option Value"];
      const price = numberValue(record.values.Price);
      if (size && price) sizePrices[size] = price;
    }
    const sizes = Object.keys(sizePrices);
    const images = [...new Set(group.flatMap((record) => [...splitImages(record.values.Images || ""), ...splitImages(record.values["Variant Image"] || "")]))];
    const price = numberValue(base.values.Price) || Math.min(...Object.values(sizePrices));
    if (!price || !Number.isFinite(price)) errors.push(`Fila ${base.row}: falta un precio válido para ${name || permalink}`);
    if (!images.length) warnings.push(`${name || permalink}: no incluye imágenes; se conservarán las existentes si el producto ya existe`);
    products.push({ row: base.row, permalink, name, description: base.values.Description || "", sku, categories, images, active: !/^(draft|unavailable|hidden|inactive)$/i.test(base.values.Status), featured: yes(base.values.Featured), stock: yes(base.values["Stock Unlimited"]) ? 999999 : numberValue(base.values.Stock), price, sizes, sizePrices });
  }
  return { products, errors, warnings, sourceRows: records.length };
}
