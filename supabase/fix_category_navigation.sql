with classified_categories as (
  select jsonb_object_agg(
    id::text,
    case
      when slug ~ '(navidad|baby-shower|halloween|ninos|papa|mama|celebracion|fiestas-patrias|bebes)'
        then 'celebrations'
      when slug ~ '(toy|snoopy|stitch|pokemon|bluey|gabby|marvel|pooh|disney|bob-esponja|pawpatrol|spiderman|lilo|netflix)'
        or slug in ('aa-pruebauno', 'aa-pruebados')
        then 'characters'
      else 'themes'
    end
  ) as category_menu
  from public.categories
  where active = true
)
update public.site_settings as settings
set
  value = jsonb_set(
    settings.value::jsonb,
    '{categoryMenu}',
    classified_categories.category_menu
  )::text,
  updated_at = now()
from classified_categories
where settings.key = 'category_navigation';

select
  menu.value as menu_id,
  count(*) as category_count
from public.site_settings as settings
cross join lateral jsonb_each_text(settings.value::jsonb -> 'categoryMenu') as menu
where settings.key = 'category_navigation'
group by menu.value
order by menu.value;
