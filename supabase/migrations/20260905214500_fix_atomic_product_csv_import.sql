-- Recreate an already-deployed importer with an unambiguous local identifier.
-- On a fresh database the preceding migration already contains the correction,
-- so these replacements are harmless no-ops.
do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.import_product_catalog(jsonb)'::regprocedure)
    into definition;
  definition := replace(definition, 'product_id uuid;', 'v_product_id uuid;');
  definition := replace(definition, 'product_id := candidate_ids[1];', 'v_product_id := candidate_ids[1];');
  definition := replace(definition, 'if product_id is null then', 'if v_product_id is null then');
  definition := replace(definition, 'returning id into product_id;', 'returning id into v_product_id;');
  definition := replace(definition, 'where id = product_id;', 'where id = v_product_id;');
  definition := replace(definition, 'import_product_catalog.product_id', 'v_product_id');
  definition := replace(definition, 'select product_id, unnest(category_ids);', 'select v_product_id, unnest(category_ids);');
  definition := replace(definition, 'values (product_id, image_url, image_index);', 'values (v_product_id, image_url, image_index);');
  definition := replace(definition, 'product_id::text', 'v_product_id::text');
  definition := replace(
    definition,
    'jsonb_object_length(coalesce(item->''sizePrices'', ''{}''::jsonb)) > 0',
    'coalesce(item->''sizePrices'', ''{}''::jsonb) <> ''{}''::jsonb'
  );
  definition := replace(definition, 'v_v_product_id', 'v_product_id');
  execute definition;
end;
$$;
