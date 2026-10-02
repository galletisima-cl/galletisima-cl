alter table public.orders
  add column shipping_tracking_number text not null default '',
  add column shipping_tracking_url text not null default '',
  add column shipping_carrier text not null default '';

-- Immutable snapshots let a failed notification be retried after a page reload.
create table public.order_status_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  order_number text not null,
  buyer_name text not null,
  recipient text not null,
  tracking_number text not null default '',
  tracking_url text not null default '',
  carrier text not null default '',
  created_at timestamptz not null default clock_timestamp(),
  sent_at timestamptz,
  first_attempt_at timestamptz,
  email_payload jsonb,
  provider_id text
);
create index order_status_notifications_order on public.order_status_notifications(order_id, created_at desc);
alter table public.order_status_notifications enable row level security;
create policy "Admins read order notifications" on public.order_status_notifications for select to authenticated
  using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
revoke all on public.order_status_notifications from anon, authenticated;
grant select (id, order_id, status, created_at, sent_at, first_attempt_at) on public.order_status_notifications to authenticated;
grant all on public.order_status_notifications to service_role;

-- The update and its pending email are committed together. Only the authenticated
-- server endpoint may invoke this function with the service role.
create or replace function public.change_order_status(
  p_order_id uuid, p_status public.order_status, p_expected_updated_at timestamptz,
  p_tracking_number text default '', p_tracking_url text default '', p_carrier text default ''
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_event_id uuid;
  v_changed boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if p_status is null or p_status = 'pending' then raise exception 'invalid_status'; end if;
  if p_status = 'shipped' and (
    length(trim(p_tracking_number)) not between 1 and 100 or
    length(p_tracking_url) > 2048 or p_tracking_url !~ '^https?://[^[:space:]]+\.[^[:space:]]+' or
    length(p_carrier) > 100
  ) then raise exception 'invalid_tracking'; end if;
  v_changed := v_order.status is distinct from p_status or (p_status = 'shipped' and (
    v_order.shipping_tracking_number is distinct from p_tracking_number or
    v_order.shipping_tracking_url is distinct from p_tracking_url or
    v_order.shipping_carrier is distinct from p_carrier));
  if v_changed then
    if p_expected_updated_at is null or v_order.updated_at is distinct from p_expected_updated_at then
      raise exception 'order_conflict' using errcode = '40001';
    end if;
    update public.orders set status = p_status,
      shipping_tracking_number = case when p_status = 'shipped' then p_tracking_number else shipping_tracking_number end,
      shipping_tracking_url = case when p_status = 'shipped' then p_tracking_url else shipping_tracking_url end,
      shipping_carrier = case when p_status = 'shipped' then p_carrier else shipping_carrier end
      where id = p_order_id returning * into v_order;
    insert into public.order_status_notifications(order_id, status, order_number, buyer_name, recipient, tracking_number, tracking_url, carrier)
      values (v_order.id, v_order.status, coalesce(v_order.public_order_number, v_order.buy_order, v_order.id::text),
        coalesce(v_order.buyer_name, ''), coalesce(v_order.buyer_email, ''), v_order.shipping_tracking_number,
        v_order.shipping_tracking_url, v_order.shipping_carrier) returning id into v_event_id;
  else
    -- A repeated request reuses the same event instead of sending another email.
    select id into v_event_id from public.order_status_notifications
      where order_id = p_order_id and status = p_status order by created_at desc limit 1;
  end if;
  return jsonb_build_object('changed', v_changed, 'event_id', v_event_id, 'order', jsonb_build_object(
    'id', v_order.id, 'status', v_order.status, 'updated_at', v_order.updated_at,
    'shipping_tracking_number', v_order.shipping_tracking_number,
    'shipping_tracking_url', v_order.shipping_tracking_url, 'shipping_carrier', v_order.shipping_carrier));
end;
$$;
revoke all on function public.change_order_status(uuid, public.order_status, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.change_order_status(uuid, public.order_status, timestamptz, text, text, text) to service_role;
