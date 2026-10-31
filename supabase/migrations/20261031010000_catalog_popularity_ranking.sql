-- Orden del catálogo completo por popularidad:
-- 1) más vendidos, 2) más vistos, 3) más buscados, 4) más nuevos.
-- Las ventas salen de los pedidos de la web; las vistas y búsquedas se
-- empiezan a registrar con esta migración (no hay historial previo en la base).

create table if not exists public.product_view_events (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_product_view_events_product on public.product_view_events(product_id, created_at desc);

create table if not exists public.search_events (
  id bigint generated always as identity primary key,
  term text not null check (char_length(term) between 2 and 100),
  source text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_search_events_created on public.search_events(created_at desc);

-- Nadie lee ni escribe estas tablas directo: solo a través de las funciones de abajo.
alter table public.product_view_events enable row level security;
alter table public.search_events enable row level security;
create policy "Admins read product views" on public.product_view_events for select to authenticated
  using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins read searches" on public.search_events for select to authenticated
  using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create or replace function public.track_product_view(p_product_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.product_view_events(product_id)
  select p.id from public.products p where p.id = p_product_id and p.active = true;
$$;

create or replace function public.track_search(p_term text, p_source text default '')
returns void language plpgsql security definer set search_path = public as $$
declare clean text := left(lower(regexp_replace(trim(coalesce(p_term, '')), '\s+', ' ', 'g')), 100);
begin
  if char_length(clean) < 2 then return; end if;
  insert into public.search_events(term, source) values (clean, left(coalesce(p_source, ''), 20));
end;
$$;

-- Puntaje de cada producto activo. Ventas: todo el historial de pedidos pagados
-- (estado distinto de pendiente o cancelado). Vistas y búsquedas: últimos 90 días.
-- Una búsqueda suma a un producto cuando el texto buscado aparece en su nombre.
create or replace function public.product_catalog_ranking()
returns table(product_id uuid, sales bigint, views bigint, searches bigint)
language sql stable security definer set search_path = public as $$
  with active_products as (
    select id, lower(name) as lname from public.products where active = true
  ),
  sold as (
    select oi.product_id, sum(oi.quantity)::bigint as n
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.status not in ('pending', 'cancelled') and oi.product_id is not null
    group by oi.product_id
  ),
  viewed as (
    select v.product_id, count(*)::bigint as n
    from public.product_view_events v
    where v.created_at > now() - interval '90 days'
    group by v.product_id
  ),
  terms as (
    select s.term, count(*)::bigint as n
    from public.search_events s
    where s.created_at > now() - interval '90 days'
    group by s.term
  ),
  searched as (
    select p.id as product_id, sum(t.n)::bigint as n
    from active_products p
    join terms t on position(t.term in p.lname) > 0
    group by p.id
  )
  select p.id, coalesce(sold.n, 0), coalesce(viewed.n, 0), coalesce(searched.n, 0)
  from active_products p
  left join sold on sold.product_id = p.id
  left join viewed on viewed.product_id = p.id
  left join searched on searched.product_id = p.id;
$$;

revoke all on function public.track_product_view(uuid) from public;
revoke all on function public.track_search(text, text) from public;
revoke all on function public.product_catalog_ranking() from public;
grant execute on function public.track_product_view(uuid) to anon, authenticated;
grant execute on function public.track_search(text, text) to anon, authenticated;
grant execute on function public.product_catalog_ranking() to anon, authenticated;
