// Manguito: agarre opcional para el stamp, 1 por cortador. Precio fijo por unidad.
export const MANGUITO_PRICE = 300;
export const MANGUITO_LABEL = "manguito";

// Los calendarios de adviento ya traen sus stamps: no se les ofrece manguito.
export function allowsManguito(productName: string | null | undefined) {
  return !/^\s*calendario de adviento/i.test(String(productName || ""));
}
