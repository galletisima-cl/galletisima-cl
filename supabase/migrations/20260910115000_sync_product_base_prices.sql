-- Keep the catalog price aligned with the lowest configured size price.
-- Product cards use products.price as their safe fallback, while product pages
-- can display the per-size prices stored in site_settings.
with configured_prices as (
  select
    product.id,
    min(size_price.value::integer) as minimum_price
  from public.products as product
  join public.site_settings as setting
    on setting.key = 'product_size_prices'
  cross join lateral jsonb_each_text(
    coalesce(setting.value::jsonb -> product.id::text, '{}'::jsonb)
  ) as size_price
  where size_price.value ~ '^[0-9]+$'
    and size_price.value::integer > 0
  group by product.id
)
update public.products as product
set price = configured_prices.minimum_price
from configured_prices
where product.id = configured_prices.id
  and product.price is distinct from configured_prices.minimum_price;
