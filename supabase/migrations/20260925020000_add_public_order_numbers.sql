create table if not exists public.order_number_sequences (
  order_date date primary key,
  next_value integer not null check (next_value > 0)
);

alter table public.orders add column if not exists public_order_number text;
create unique index if not exists idx_orders_public_order_number
  on public.orders(public_order_number) where public_order_number is not null;

with numbered as (
  select id,
    to_char(created_at at time zone 'America/Santiago', 'YYYYMMDD') ||
    lpad(row_number() over (partition by (created_at at time zone 'America/Santiago')::date order by created_at, id)::text, 3, '0') as number
  from public.orders
  where public_order_number is null
)
update public.orders as orders
set public_order_number = numbered.number
from numbered
where orders.id = numbered.id;

insert into public.order_number_sequences (order_date, next_value)
select (created_at at time zone 'America/Santiago')::date, count(*) + 1
from public.orders
group by (created_at at time zone 'America/Santiago')::date
on conflict (order_date) do update set next_value = greatest(public.order_number_sequences.next_value, excluded.next_value);

create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chile_date date := (now() at time zone 'America/Santiago')::date;
  sequence_number integer;
begin
  insert into public.order_number_sequences (order_date, next_value)
  values (chile_date, 2)
  on conflict (order_date) do update
    set next_value = public.order_number_sequences.next_value + 1
  returning next_value - 1 into sequence_number;

  return to_char(chile_date, 'YYYYMMDD') || lpad(sequence_number::text, 3, '0');
end;
$$;

revoke all on function public.next_order_number() from public, anon, authenticated;
grant execute on function public.next_order_number() to service_role;

