alter table public.products
add column category_id uuid references public.categories(id) on delete restrict;

update public.products as product
set category_id = link.category_id
from (
  select distinct on (product_id) product_id, category_id
  from public.product_categories
  order by product_id, category_id
) as link
where link.product_id = product.id;

update public.products
set category_id = (select id from public.categories order by created_at, id limit 1)
where category_id is null;

do $$
begin
  if exists (select 1 from public.products where category_id is null) then
    raise exception 'No se puede exigir categoría: existen productos y no hay categorías disponibles';
  end if;
end;
$$;

alter table public.products
alter column category_id set not null;

create index idx_products_category_id on public.products(category_id);
