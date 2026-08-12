-- Autoriza solamente al usuario administrador inicial creado en Supabase Auth.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb,
    updated_at = now()
where lower(email) = 'galletisima.web@gmail.com';

do $$
begin
  if not exists (
    select 1 from auth.users
    where lower(email) = 'galletisima.web@gmail.com'
      and raw_app_meta_data ->> 'role' = 'admin'
  ) then
    raise exception 'No se encontró el usuario Auth galletisima.web@gmail.com';
  end if;
end $$;
