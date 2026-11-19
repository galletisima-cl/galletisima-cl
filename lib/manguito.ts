// Manguito: agarre opcional para el stamp, 1 por cortador. Precio fijo por unidad.
export const MANGUITO_PRICE = 300;
export const MANGUITO_LABEL = "manguito";

// Calendarios de adviento y sets (incluye las casitas armables, que se llaman "Set Casita ...")
// no llevan manguito. Los cortadores sueltos (ej. "Casita Jengibre") sí lo ofrecen.
export function allowsManguito(productName: string | null | undefined) {
  return !/^\s*(calendario de adviento|set\b)/i.test(String(productName || ""));
}
