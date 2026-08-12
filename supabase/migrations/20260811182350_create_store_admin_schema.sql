create extension if not exists pgcrypto;

create table public.categories (
  id uuid primary key default gen_random_uuid(), name text not null,
  slug text not null unique, description text not null default '',
  active boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, sku text not null unique,
  source_group text not null default '', source_number text not null default '',
  description text not null default '', price integer not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0), size text not null default '',
  image_url text not null default '', active boolean not null default true,
  featured boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null unique,
  phone text not null default '', created_at timestamptz not null default now()
);

create type public.order_status as enum ('pending','review','preparing','shipped','delivered','cancelled');
create table public.orders (
  id uuid primary key default gen_random_uuid(), customer_id uuid references public.customers(id) on delete restrict,
  status public.order_status not null default 'pending', subtotal integer not null default 0 check (subtotal >= 0),
  shipping integer not null default 0 check (shipping >= 0), total integer not null default 0 check (total >= 0),
  notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, name text not null,
  quantity integer not null check (quantity > 0), unit_price integer not null check (unit_price >= 0),
  line_total integer generated always as (quantity * unit_price) stored
);

create index idx_product_categories_category on public.product_categories(category_id, product_id);
create index idx_products_stock_low on public.products(stock) where active = true and stock <= 5;
create index idx_orders_status_created on public.orders(status, created_at desc);
create index idx_orders_customer on public.orders(customer_id);
create index idx_order_items_order on public.order_items(order_id);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Public can view active categories" on public.categories for select to anon, authenticated using (active = true or (select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Public can view active products" on public.products for select to anon, authenticated using (active = true or (select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Public can view product categories" on public.product_categories for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and (p.active = true or (select auth.jwt()->'app_metadata'->>'role') = 'admin')));
create policy "Admins manage categories" on public.categories for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins manage products" on public.products for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins manage product categories" on public.product_categories for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins manage customers" on public.customers for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins manage orders" on public.orders for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins manage order items" on public.order_items for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

grant select on public.categories, public.products, public.product_categories to anon;
grant select, insert, update, delete on public.categories, public.products, public.product_categories, public.customers, public.orders, public.order_items to authenticated;
