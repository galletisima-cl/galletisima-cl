alter table public.products add column if not exists external_permalink text;
create unique index if not exists products_external_permalink_unique
  on public.products (external_permalink) where external_permalink is not null;

create or replace function public.catalog_slug(source text)
returns text language sql immutable strict set search_path = '' as $$
  select trim(both '-' from regexp_replace(
    translate(lower(trim(source)), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create or replace function public.import_product_catalog(catalog jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_variable
declare
  item jsonb;
  category_name text;
  category_id uuid;
  category_ids uuid[];
  candidate_ids uuid[];
  v_product_id uuid;
  product_slug text;
  image_url text;
  image_index integer;
  sizes_text text;
  size_prices jsonb := '{}'::jsonb;
  imported_count integer := 0;
begin
  if coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
    raise exception 'No tienes permisos de administración' using errcode = '42501';
  end if;
  if jsonb_typeof(catalog) <> 'array' or jsonb_array_length(catalog) = 0 then
    raise exception 'El catálogo debe contener al menos un producto' using errcode = '22023';
  end if;
  if jsonb_array_length(catalog) > 5000 then
    raise exception 'El catálogo supera el máximo de 5.000 productos' using errcode = '22023';
  end if;

  select coalesce(value::jsonb, '{}'::jsonb) into size_prices
  from public.site_settings where key = 'product_size_prices' for update;
  size_prices := coalesce(size_prices, '{}'::jsonb);

  for item in select value from jsonb_array_elements(catalog)
  loop
    if nullif(trim(item->>'permalink'), '') is null
      or nullif(trim(item->>'name'), '') is null
      or nullif(trim(item->>'sku'), '') is null then
      raise exception 'Producto inválido en la fila %', item->>'row' using errcode = '22023';
    end if;
    if (item->>'sku') !~ '^[A-Z0-9]+$' then
      raise exception 'SKU inválido en la fila %', item->>'row' using errcode = '22023';
    end if;
    if coalesce((item->>'price')::integer, 0) <= 0 or coalesce((item->>'stock')::integer, -1) < 0 then
      raise exception 'Precio o stock inválido en la fila %', item->>'row' using errcode = '22023';
    end if;

    product_slug := public.catalog_slug(item->>'name');
    select array_agg(id order by id) into candidate_ids
    from public.products
    where external_permalink = item->>'permalink'
       or sku = item->>'sku'
       or slug = product_slug;
    if cardinality(candidate_ids) > 1 then
      raise exception 'Conflicto de identidad para %: Permalink, SKU y nombre apuntan a productos distintos', item->>'name' using errcode = '23505';
    end if;
    v_product_id := candidate_ids[1];

    category_ids := array[]::uuid[];
    for category_name in select value from jsonb_array_elements_text(item->'categories')
    loop
      if nullif(trim(category_name), '') is null then continue; end if;
      insert into public.categories (name, slug, description, active)
      values (trim(category_name), public.catalog_slug(category_name), '', true)
      on conflict (slug) do update set name = excluded.name
      returning id into category_id;
      category_ids := array_append(category_ids, category_id);
    end loop;
    if cardinality(category_ids) = 0 then
      raise exception '% no tiene categorías válidas', item->>'name' using errcode = '23502';
    end if;

    select string_agg(value, ', ' order by ordinality) into sizes_text
    from jsonb_array_elements_text(coalesce(item->'sizes', '[]'::jsonb)) with ordinality;
    image_url := nullif(item->'images'->>0, '');

    if v_product_id is null then
      insert into public.products (external_permalink, name, slug, sku, description, price, stock, size, image_url, active, featured, category_id)
      values (item->>'permalink', trim(item->>'name'), product_slug, item->>'sku', coalesce(item->>'description', ''),
        (item->>'price')::integer, (item->>'stock')::integer, coalesce(sizes_text, ''), coalesce(image_url, ''),
        (item->>'active')::boolean, (item->>'featured')::boolean, category_ids[1])
      returning id into v_product_id;
    else
      update public.products set
        external_permalink = item->>'permalink', name = trim(item->>'name'), slug = product_slug, sku = item->>'sku',
        description = coalesce(item->>'description', ''), price = (item->>'price')::integer,
        stock = (item->>'stock')::integer, size = coalesce(sizes_text, ''),
        image_url = coalesce(image_url, products.image_url), active = (item->>'active')::boolean,
        featured = (item->>'featured')::boolean, category_id = category_ids[1]
      where id = v_product_id;
    end if;

    delete from public.product_categories where product_categories.product_id = v_product_id;
    insert into public.product_categories (product_id, category_id)
    select v_product_id, unnest(category_ids);

    if jsonb_array_length(coalesce(item->'images', '[]'::jsonb)) > 0 then
      delete from public.product_images where product_images.product_id = v_product_id;
      image_index := 0;
      for image_url in select value from jsonb_array_elements_text(item->'images') limit 8
      loop
        if image_url !~ '^https?://' then
          raise exception 'URL de imagen inválida para %', item->>'name' using errcode = '22023';
        end if;
        insert into public.product_images (product_id, image_url, sort_order)
        values (v_product_id, image_url, image_index);
        image_index := image_index + 1;
      end loop;
    end if;

    if coalesce(item->'sizePrices', '{}'::jsonb) <> '{}'::jsonb then
      size_prices := (size_prices - v_product_id::text) || jsonb_build_object(v_product_id::text, item->'sizePrices');
    else
      size_prices := size_prices - v_product_id::text;
    end if;
    imported_count := imported_count + 1;
  end loop;

  insert into public.site_settings (key, value, updated_at)
  values ('product_size_prices', size_prices::text, now())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  return jsonb_build_object('imported', imported_count);
end;
$$;

revoke all on function public.import_product_catalog(jsonb) from public, anon;
grant execute on function public.import_product_catalog(jsonb) to authenticated;
