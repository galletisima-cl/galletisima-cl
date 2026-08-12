create table public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

create policy "Public can read site settings"
on public.site_settings for select
to anon, authenticated
using (true);

create policy "Admins can manage site settings"
on public.site_settings for all
to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

insert into public.site_settings (key, value)
values ('whatsapp_number', '56975265959');
