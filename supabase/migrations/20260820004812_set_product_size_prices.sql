-- Precios estándar de los cortadores por tamaño (CLP).
-- La tienda consulta esta configuración por ID de producto.
with standard_prices as (
  select jsonb_build_object(
    '6 cm', 1600,
    '8 cm', 2000,
    '10 cm', 2500,
    '12 cm', 2900,
    '14 cm', 3400,
    '16 cm', 3900
  ) as prices
), product_prices as (
  select coalesce(
    jsonb_object_agg(products.id::text, standard_prices.prices),
    '{}'::jsonb
  ) as value
  from public.products
  cross join standard_prices
)
insert into public.site_settings (key, value, updated_at)
select 'product_size_prices', product_prices.value::text, now()
from product_prices
on conflict (key) do update
set
  value = excluded.value,
  updated_at = excluded.updated_at;

