insert into public.site_settings (key, value) values
  ('hero_eyebrow', 'CREA SIN LÍMITES'),
  ('hero_title', 'Transforma tus ideas en obras de arte'),
  ('hero_subtitle', 'Encuentra el cortador perfecto para tu próxima celebración o diseñemos juntos un molde 100% a tu medida.'),
  ('hero_primary_button', 'VER CATÁLOGO'),
  ('hero_secondary_button', 'PEDIDO PERSONALIZADO')
on conflict (key) do nothing;
