// Precio que se muestra en las tarjetas del catálogo: si hay un precio configurado
// para la primera medida del producto se usa ese, y si no, el precio base.
export function productDisplayPrice(
  product: { id: string; size: string; price: number },
  configuredPrices: Record<string, Record<string, number>>,
) {
  const firstSize = product.size.split(/[,;\n]+/).map((size) => size.trim()).find(Boolean);
  const configuredPrice = firstSize ? Number(configuredPrices[product.id]?.[firstSize]) : 0;
  return configuredPrice > 0 ? configuredPrice : product.price;
}
