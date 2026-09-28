create table if not exists public.shipping_rates (
  commune_id text primary key,
  price integer not null check (price >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.shipping_rates enable row level security;

create policy "Public can view shipping rates" on public.shipping_rates
  for select to anon, authenticated using (true);

create policy "Admins manage shipping rates" on public.shipping_rates
  for all to authenticated
  using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

grant select on public.shipping_rates to anon, authenticated;
grant insert, update, delete on public.shipping_rates to authenticated;

alter table public.orders
  add column if not exists shipping_region_id text,
  add column if not exists shipping_region text not null default '',
  add column if not exists shipping_commune_id text,
  add column if not exists shipping_commune text not null default '',
  add column if not exists shipping_address text not null default '',
  add column if not exists shipping_address_extra text not null default '';

